import { t } from './i18n.js';
import { sendToOffscreen } from './offscreen-manager.js';
import {
  SETTINGS_KEY,
  ensureMyMemoryEmail,
  getSettings,
  setSettings,
  subscribeToSettings,
} from './settings.js';
import { getQuota, translate } from './translation/translation-service.js';

function applyActionTitle(enabled) {
  return chrome.action.setTitle({
    title: t(enabled ? 'actionTitle' : 'actionTitleDisabled'),
  });
}

async function syncActionFromSettings() {
  const settings = await getSettings();
  await applyActionTitle(settings.enabled);
}

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(SETTINGS_KEY);
  // Writes normalized defaults on first install; keeps existing values on update.
  if (!data[SETTINGS_KEY]) await setSettings({});
  ensureMyMemoryEmail().catch(() => undefined);
  syncActionFromSettings();
});

chrome.runtime.onStartup.addListener(() => {
  ensureMyMemoryEmail().catch(() => undefined);
  syncActionFromSettings();
});

subscribeToSettings((settings) => applyActionTitle(settings.enabled));
syncActionFromSettings();

function chromeModelError(error, fallback) {
  return {
    availability: 'unsupported',
    downloading: false,
    progress: 0,
    error: error.message || fallback,
  };
}

/** Each handler returns a promise of the response sent back to the caller. */
const MESSAGE_HANDLERS = {
  GET_CHROME_MODEL_STATUS: ({ sourceLanguage, targetLanguage }) =>
    sendToOffscreen({ type: 'OFFSCREEN_MODEL_STATUS', sourceLanguage, targetLanguage })
      .then((response) => response.status)
      .catch((error) => chromeModelError(error, t('errorModelStatus'))),

  ENSURE_CHROME_MODEL: ({ sourceLanguage, targetLanguage }) =>
    sendToOffscreen({ type: 'OFFSCREEN_ENSURE_MODEL', sourceLanguage, targetLanguage })
      .then((response) => response.status)
      .catch((error) => chromeModelError(error, t('errorModelDownload'))),

  GET_TRANSLATE_SHORTCUT: async () => {
    const commands = await chrome.commands.getAll().catch(() => []);
    const command = commands.find(({ name }) => name === 'translate-selection');
    return { shortcut: command?.shortcut || '' };
  },

  GET_QUOTA: () =>
    getQuota().catch((error) => ({ error: error.message || t('errorQuotaRead') })),

  TRANSLATE: ({ text, sourceLanguage }) =>
    translate(text, { sourceLanguage }).catch((error) => ({
      error: error.message || t('errorTranslationFailed'),
    })),
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const handler = MESSAGE_HANDLERS[message?.type];
  if (!handler) return;
  handler(message).then(sendResponse);
  return true;
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'translate-selection') return;

  const settings = await getSettings();
  if (!settings.enabled) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id)
    chrome.tabs.sendMessage(tab.id, { type: 'TRANSLATE_HOTKEY' }).catch(() => {});
});
