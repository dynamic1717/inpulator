(function () {
  'use strict';

  const settingsApi = window.InputTranslate.settings;
  const enabledToggle = document.getElementById('enabled-toggle');
  const counterToggle = document.getElementById('counter-toggle');
  const providerSelect = document.getElementById('provider-select');
  const providerHint = document.getElementById('provider-hint');
  const quotaLabel = document.getElementById('quota-label');
  const quotaValue = document.getElementById('quota-value');
  const quotaBar = document.getElementById('quota-bar');
  const quotaMeter = quotaBar.parentElement;
  const chromeModel = document.getElementById('chrome-model');
  const chromeModelValue = document.getElementById('chrome-model-value');
  const chromeModelMeter = document.getElementById('chrome-model-meter');
  const chromeModelBar = document.getElementById('chrome-model-bar');
  const chromeModelHint = document.getElementById('chrome-model-hint');
  const chromeModelDownload = document.getElementById('chrome-model-download');
  const googleApiKeyField = document.getElementById('google-api-key-field');
  const googleApiKey = document.getElementById('google-api-key');
  const googleApiKeyHint = document.getElementById('google-api-key-hint');
  const googleApiKeyClear = document.getElementById('google-api-key-clear');
  const blockedDomains = document.getElementById('blocked-domains');

  const PROVIDER_HINTS = {
    chrome:
      'On-device, без ключа и лимита API. Приватно и офлайн после скачивания пакетов.',
    google:
      'До 500 000 символов/мес. Нужен личный API key и интернет; текст уходит в Google.',
    mymemory: 'До 50 000 символов/день. Текст уходит на внешний сервис MyMemory.',
  };

  function applyProviderHint(provider) {
    providerHint.hidden = false;
    providerHint.textContent = PROVIDER_HINTS[provider] || PROVIDER_HINTS.chrome;
  }

  let modelPollTimer = null;

  function formatCount(value) {
    if (value == null) return '…';
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function stopModelPoll() {
    if (modelPollTimer != null) {
      clearInterval(modelPollTimer);
      modelPollTimer = null;
    }
  }

  function startModelPoll() {
    if (modelPollTimer != null) return;
    modelPollTimer = setInterval(() => {
      loadChromeModelStatus({ silent: true });
    }, 500);
  }

  function applyChromeModelStatus(status) {
    if (!status) {
      chromeModelValue.textContent = '…';
      chromeModelMeter.hidden = true;
      chromeModelDownload.hidden = true;
      chromeModelHint.hidden = true;
      stopModelPoll();
      return;
    }

    const percent = Math.round(Math.min(1, Math.max(0, status.progress || 0)) * 100);
    const isDownloading = status.downloading || status.availability === 'downloading';

    if (isDownloading) {
      chromeModelValue.textContent = `${percent}%`;
      chromeModelMeter.hidden = false;
      chromeModelBar.style.width = `${percent}%`;
      chromeModelDownload.hidden = true;
      chromeModelDownload.disabled = false;
      chromeModelHint.hidden = false;
      chromeModelHint.textContent = 'Скачивание языковых пакетов…';
      startModelPoll();
      return;
    }

    stopModelPoll();
    chromeModelMeter.hidden = true;
    chromeModelBar.style.width = '0%';

    if (status.availability === 'available') {
      chromeModelValue.textContent = '✓';
      chromeModelDownload.hidden = true;
      chromeModelHint.hidden = true;
      return;
    }

    if (status.availability === 'downloadable') {
      chromeModelValue.textContent = 'Не скачаны';
      chromeModelDownload.hidden = false;
      chromeModelDownload.disabled = false;
      chromeModelHint.hidden = false;
      chromeModelHint.textContent = 'Нужны для on-device перевода RU→EN';
      return;
    }

    if (status.availability === 'unavailable') {
      chromeModelValue.textContent = 'Недоступны';
      chromeModelDownload.hidden = true;
      chromeModelHint.hidden = false;
      chromeModelHint.textContent = status.error || 'Пара RU→EN не поддерживается';
      return;
    }

    chromeModelValue.textContent = 'Нет API';
    chromeModelDownload.hidden = true;
    chromeModelHint.hidden = false;
    chromeModelHint.textContent =
      status.error || 'Нужен Chrome 138+ (desktop) с Translator API';
  }

  async function loadChromeModelStatus({ silent = false } = {}) {
    if (providerSelect.value !== 'chrome') {
      chromeModel.hidden = true;
      stopModelPoll();
      return;
    }

    chromeModel.hidden = false;
    try {
      const status = await chrome.runtime.sendMessage({
        type: 'GET_CHROME_MODEL_STATUS',
      });
      applyChromeModelStatus(status);
    } catch (error) {
      if (!silent) {
        applyChromeModelStatus({
          availability: 'unsupported',
          downloading: false,
          progress: 0,
          error: error.message,
        });
      }
    }
  }

  function applySettingsToUi(settings) {
    enabledToggle.checked = settings.enabled;
    counterToggle.checked = settings.showCharCounter;
    providerSelect.value = settings.provider;
    applyProviderHint(settings.provider);
    chromeModel.hidden = settings.provider !== 'chrome';
    googleApiKeyField.hidden = settings.provider !== 'google';
    blockedDomains.value = settings.blockedDomains.join(', ');
    if (settings.provider !== 'chrome') stopModelPoll();
  }

  async function loadGoogleApiKeyStatus() {
    const apiKey = await settingsApi.getGoogleApiKey();
    googleApiKey.value = '';
    googleApiKey.placeholder = apiKey ? 'Ключ сохранён' : 'Введите личный ключ';
    googleApiKeyClear.hidden = !apiKey;
    googleApiKeyHint.textContent = apiKey
      ? 'Личный ключ сохранён локально в расширении.'
      : 'Ключ не задан. Google Translate недоступен.';
  }

  function parseBlockedDomains(value) {
    return value
      .split(/[\n,]/)
      .map((domain) => settingsApi.normalizeDomain(domain))
      .filter(Boolean);
  }

  async function loadQuota() {
    try {
      const quota = await chrome.runtime.sendMessage({ type: 'GET_QUOTA' });

      if (quota?.period === 'none' || quota?.limit == null) {
        quotaLabel.textContent = 'Лимит';
        quotaValue.textContent = 'Без лимита';
        quotaBar.style.width = '0%';
        if (quotaMeter) quotaMeter.hidden = true;
        return;
      }

      if (quotaMeter) quotaMeter.hidden = false;
      const used = quota?.charsUsed ?? 0;
      const limit = quota?.limit ?? quota?.dailyLimit ?? 0;
      const period = quota?.period === 'day' ? 'день' : 'месяц';
      quotaLabel.textContent = `Лимит за ${period}`;
      quotaValue.textContent = `${formatCount(used)} / ${formatCount(limit)}`;
      const percent = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
      quotaBar.style.width = `${percent}%`;
    } catch {
      quotaLabel.textContent = 'Лимит';
      quotaValue.textContent = '… / …';
      quotaBar.style.width = '0%';
      if (quotaMeter) quotaMeter.hidden = false;
    }
  }

  async function init() {
    const settings = await settingsApi.getSettings();
    applySettingsToUi(settings);
    await loadGoogleApiKeyStatus();
    await loadQuota();
    await loadChromeModelStatus();

    enabledToggle.addEventListener('change', async () => {
      const next = await settingsApi.setSettings({ enabled: enabledToggle.checked });
      applySettingsToUi(next);
    });

    counterToggle.addEventListener('change', async () => {
      const next = await settingsApi.setSettings({
        showCharCounter: counterToggle.checked,
      });
      applySettingsToUi(next);
    });

    providerSelect.addEventListener('change', async () => {
      const next = await settingsApi.setSettings({ provider: providerSelect.value });
      applySettingsToUi(next);
      await loadQuota();
      await loadChromeModelStatus();
      if (next.provider === 'google') await loadGoogleApiKeyStatus();
    });

    googleApiKey.addEventListener('change', async () => {
      const apiKey = googleApiKey.value.trim();
      if (!apiKey) return;
      await settingsApi.setGoogleApiKey(apiKey);
      await loadGoogleApiKeyStatus();
      await loadQuota();
    });

    googleApiKeyClear.addEventListener('click', async () => {
      await settingsApi.setGoogleApiKey('');
      await loadGoogleApiKeyStatus();
      await loadQuota();
    });

    blockedDomains.addEventListener('change', async () => {
      const next = await settingsApi.setSettings({
        blockedDomains: parseBlockedDomains(blockedDomains.value),
      });
      applySettingsToUi(next);
    });

    chromeModelDownload.addEventListener('click', async () => {
      chromeModelDownload.disabled = true;
      chromeModelValue.textContent = '0%';
      chromeModelMeter.hidden = false;
      chromeModelBar.style.width = '0%';
      chromeModelHint.hidden = false;
      chromeModelHint.textContent = 'Скачивание языковых пакетов…';
      startModelPoll();
      try {
        const status = await chrome.runtime.sendMessage({
          type: 'ENSURE_CHROME_MODEL',
        });
        applyChromeModelStatus(status);
      } catch (error) {
        applyChromeModelStatus({
          availability: 'downloadable',
          downloading: false,
          progress: 0,
          error: error.message,
        });
        chromeModelHint.hidden = false;
        chromeModelHint.textContent = error.message || 'Не удалось скачать пакеты';
        chromeModelDownload.hidden = false;
        chromeModelDownload.disabled = false;
      }
    });

    chrome.runtime.onMessage.addListener((message) => {
      if (
        message?.type !== 'CHROME_MODEL_STATUS' ||
        providerSelect.value !== 'chrome'
      ) {
        return;
      }
      applyChromeModelStatus(message.status);
    });

    settingsApi.subscribe((next) => {
      applySettingsToUi(next);
      loadQuota();
      loadChromeModelStatus();
    });
  }

  init();
})();
