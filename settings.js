(function () {
  'use strict';

  if (window.__inputTranslateSettings) return;

  window.InputTranslate = window.InputTranslate || {};

  const SETTINGS_KEY = 'extensionSettings';
  const DEFAULT_SETTINGS = {
    enabled: true,
    showCharCounter: true,
  };

  function normalizeSettings(raw) {
    return {
      enabled: raw?.enabled !== false,
      showCharCounter: raw?.showCharCounter !== false,
    };
  }

  async function getSettings() {
    const data = await chrome.storage.local.get(SETTINGS_KEY);
    return normalizeSettings(data[SETTINGS_KEY]);
  }

  async function setSettings(patch) {
    const current = await getSettings();
    const next = normalizeSettings({ ...current, ...patch });
    await chrome.storage.local.set({ [SETTINGS_KEY]: next });
    return next;
  }

  function subscribe(onChange) {
    function listener(changes, areaName) {
      if (areaName !== 'local' || !changes[SETTINGS_KEY]) return;
      onChange(normalizeSettings(changes[SETTINGS_KEY].newValue));
    }

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }

  window.InputTranslate.settings = {
    SETTINGS_KEY,
    DEFAULT_SETTINGS,
    normalizeSettings,
    getSettings,
    setSettings,
    subscribe,
  };
  window.__inputTranslateSettings = true;
})();
