import { getQuota, translate } from './translation/translation-service.js';
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  normalizeSettings,
} from './settings-defaults.js';

const COLOR_ICONS = {
  16: 'icons/icon16.png',
  48: 'icons/icon48.png',
  128: 'icons/icon128.png',
};

const DISABLED_ICONS = {
  16: 'icons/icon16-disabled.png',
  48: 'icons/icon48-disabled.png',
  128: 'icons/icon128-disabled.png',
};

async function getSettings() {
  const data = await chrome.storage.local.get(SETTINGS_KEY);
  return normalizeSettings(data[SETTINGS_KEY]);
}

async function applyActionIcon(enabled) {
  await chrome.action.setIcon({
    path: enabled ? COLOR_ICONS : DISABLED_ICONS,
  });
  await chrome.action.setTitle({
    title: enabled ? 'Input Translate — Перевод текста' : 'Input Translate — выключено',
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
  syncActionFromSettings();
});

chrome.runtime.onStartup.addListener(() => {
  syncActionFromSettings();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes[SETTINGS_KEY]) return;
  const settings = normalizeSettings(changes[SETTINGS_KEY].newValue);
  applyActionIcon(settings.enabled);
});

syncActionFromSettings();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_QUOTA') {
    getQuota()
      .then(sendResponse)
      .catch(() => sendResponse({ charsUsed: 0, dailyLimit: 50000, remaining: 50000 }));
    return true;
  }

  if (message.type !== 'TRANSLATE') return;

  translate(message.text)
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
