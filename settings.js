(function () {
  'use strict';

  if (window.__inputTranslateSettings) return;

  window.InputTranslate = window.InputTranslate || {};

  const SETTINGS_KEY = 'extensionSettings';
  const GOOGLE_API_KEY_STORAGE_KEY = 'googleTranslateApiKey';
  const DEFAULT_SETTINGS = {
    enabled: true,
    provider: 'mymemory',
    blockedDomains: [],
    targetLanguage: 'en',
    disabledSourceLanguages: [],
  };

  function getLanguagesApi() {
    return window.InputTranslate.languages;
  }

  function normalizeDomain(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/^\*\./, '')
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/^\.+|\.+$/g, '');
  }

  function normalizeDisabledSourceLanguages(raw) {
    const languagesApi = getLanguagesApi();
    if (!Array.isArray(raw) || !languagesApi) return [];
    const shipped = new Set(languagesApi.getShippedLanguageIds());
    return [
      ...new Set(
        raw
          .map((id) => languagesApi.normalizeLanguageId(id))
          .filter((id) => id && shipped.has(id))
      ),
    ];
  }

  function normalizeSettings(raw) {
    const languagesApi = getLanguagesApi();
    const provider =
      raw?.provider === 'chrome' || raw?.provider === 'google'
        ? raw.provider
        : 'mymemory';
    const blockedDomains = Array.isArray(raw?.blockedDomains)
      ? [...new Set(raw.blockedDomains.map(normalizeDomain).filter(Boolean))]
      : [];
    const targetLanguage =
      languagesApi?.isShippedLanguageId(raw?.targetLanguage) && raw.targetLanguage
        ? raw.targetLanguage
        : 'en';

    return {
      enabled: raw?.enabled !== false,
      provider,
      blockedDomains,
      targetLanguage,
      disabledSourceLanguages: normalizeDisabledSourceLanguages(
        raw?.disabledSourceLanguages
      ),
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

  async function getGoogleApiKey() {
    const data = await chrome.storage.local.get(GOOGLE_API_KEY_STORAGE_KEY);
    return String(data[GOOGLE_API_KEY_STORAGE_KEY] || '').trim();
  }

  async function setGoogleApiKey(value) {
    const apiKey = String(value || '').trim();
    if (apiKey) {
      await chrome.storage.local.set({ [GOOGLE_API_KEY_STORAGE_KEY]: apiKey });
    } else {
      await chrome.storage.local.remove(GOOGLE_API_KEY_STORAGE_KEY);
    }
    return apiKey;
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
    normalizeDomain,
    getSettings,
    setSettings,
    getGoogleApiKey,
    setGoogleApiKey,
    subscribe,
  };
  window.__inputTranslateSettings = true;
})();
