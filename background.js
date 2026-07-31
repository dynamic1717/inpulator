import { getQuota, translate } from './translation/translation-service.js';
import { sendToOffscreen } from './offscreen-manager.js';
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  ensureMyMemoryEmail,
  normalizeSettings,
} from './settings-defaults.js';

const COLOR_ICONS = {
  16: 'icons/icon16.png',
  48: 'icons/icon48.png',
  128: 'icons/icon128.png',
};

async function getSettings() {
  const data = await chrome.storage.local.get(SETTINGS_KEY);
  return normalizeSettings(data[SETTINGS_KEY]);
}

async function applyActionIcon(enabled) {
  await chrome.action.setIcon({
    path: COLOR_ICONS,
  });
  await chrome.action.setTitle({
    title: enabled ? 'Inpulator — Translate input' : 'Inpulator — disabled',
  });
}

async function syncActionFromSettings() {
  const settings = await getSettings();
  await applyActionIcon(settings.enabled);
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(SETTINGS_KEY, (data) => {
    if (!data[SETTINGS_KEY]) {
      chrome.storage.local.set({ [SETTINGS_KEY]: { ...DEFAULT_SETTINGS } });
    }
  });
  ensureMyMemoryEmail().catch(() => undefined);
  syncActionFromSettings();
});

chrome.runtime.onStartup.addListener(() => {
  ensureMyMemoryEmail().catch(() => undefined);
  syncActionFromSettings();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes[SETTINGS_KEY]) return;
  const settings = normalizeSettings(changes[SETTINGS_KEY].newValue);
  applyActionIcon(settings.enabled);
});

syncActionFromSettings();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'CHROME_MODEL_STATUS' && message.status) {
    // Broadcast from offscreen — popup may listen; no response needed.
    return;
  }

  if (message.type === 'GET_CHROME_MODEL_STATUS') {
    const sourceLanguage = message.sourceLanguage || 'ru';
    const targetLanguage = message.targetLanguage || 'en';
    sendToOffscreen({
      type: 'OFFSCREEN_MODEL_STATUS',
      sourceLanguage,
      targetLanguage,
    })
      .then((response) => sendResponse(response?.status || response))
      .catch((error) =>
        sendResponse({
          availability: 'unsupported',
          downloading: false,
          progress: 0,
          error: error.message || 'Cannot get model status',
        })
      );
    return true;
  }

  if (message.type === 'ENSURE_CHROME_MODEL') {
    const sourceLanguage = message.sourceLanguage || 'ru';
    const targetLanguage = message.targetLanguage || 'en';
    sendToOffscreen({
      type: 'OFFSCREEN_ENSURE_MODEL',
      sourceLanguage,
      targetLanguage,
    })
      .then((response) => sendResponse(response?.status || response))
      .catch((error) =>
        sendResponse({
          availability: 'unsupported',
          downloading: false,
          progress: 0,
          error: error.message || 'Cannot download model',
        })
      );
    return true;
  }

  if (message.type === 'GET_QUOTA') {
    getQuota()
      .then(sendResponse)
      .catch(() =>
        sendResponse({
          charsUsed: 0,
          limit: null,
          dailyLimit: null,
          remaining: null,
          period: 'none',
          provider: 'chrome',
        })
      );
    return true;
  }

  if (message.type !== 'TRANSLATE') return;

  translate(message.text, { sourceLanguage: message.sourceLanguage })
    .then(sendResponse)
    .catch((error) => sendResponse({ error: error.message || 'Translation failed' }));
  return true;
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'translate-selection') return;

  const settings = await getSettings();
  if (!settings.enabled) return;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0]?.id;
    if (tabId) chrome.tabs.sendMessage(tabId, { type: 'TRANSLATE_HOTKEY' });
  });
});
