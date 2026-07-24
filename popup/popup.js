(function () {
  'use strict';

  const settingsApi = window.InputTranslate.settings;
  const languagesApi = window.InputTranslate.languages;
  const enabledToggle = document.getElementById('enabled-toggle');
  const counterToggle = document.getElementById('counter-toggle');
  const targetLanguageSelect = document.getElementById('target-language-select');
  const disabledSourcePills = document.getElementById('disabled-source-pills');
  const excludeCurrentRow = document.getElementById('exclude-current-row');
  const excludeCurrentLabel = document.getElementById('exclude-current-label');
  const excludeCurrentBtn = document.getElementById('exclude-current-btn');
  const excludeSelectRow = document.getElementById('exclude-select-row');
  const excludeLanguageSelect = document.getElementById('exclude-language-select');
  const excludeLanguageBtn = document.getElementById('exclude-language-btn');
  const providerSelect = document.getElementById('provider-select');
  const providerHint = document.getElementById('provider-hint');
  const quotaLabel = document.getElementById('quota-label');
  const quotaValue = document.getElementById('quota-value');
  const quotaBar = document.getElementById('quota-bar');
  const quotaMeter = quotaBar.parentElement;
  const chromeModel = document.getElementById('chrome-model');
  const chromeModelLabel = document.getElementById('chrome-model-label');
  const chromeModelValue = document.getElementById('chrome-model-value');
  const chromeModelMeter = document.getElementById('chrome-model-meter');
  const chromeModelBar = document.getElementById('chrome-model-bar');
  const chromeModelHint = document.getElementById('chrome-model-hint');
  const chromeModelDownload = document.getElementById('chrome-model-download');
  const googleApiKeyField = document.getElementById('google-api-key-field');
  const googleApiKey = document.getElementById('google-api-key');
  const googleApiKeyHint = document.getElementById('google-api-key-hint');
  const googleApiKeyClear = document.getElementById('google-api-key-clear');
  const siteToggle = document.getElementById('site-toggle');
  const siteToggleHint = document.getElementById('site-toggle-hint');

  let currentHostname = null;
  let currentSettings = null;
  let selectionSourceLanguage = null;

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

  function formatLanguageLabel(lang) {
    return `${lang.flag} ${lang.name}`;
  }

  function pairLabel(sourceCode, targetCode) {
    const source =
      languagesApi.getShortLabel?.(sourceCode) || String(sourceCode).toUpperCase();
    const target =
      languagesApi.getShortLabel?.(targetCode) || String(targetCode).toUpperCase();
    return `${source}→${target}`;
  }

  function getProbePair(settings) {
    return languagesApi.getChromeProbePair(
      settings?.targetLanguage || 'en',
      selectionSourceLanguage
    );
  }

  function populateTargetLanguageSelect() {
    targetLanguageSelect.innerHTML = '';
    for (const lang of languagesApi.getShippedLanguages()) {
      const option = document.createElement('option');
      option.value = lang.id;
      option.textContent = formatLanguageLabel(lang);
      targetLanguageSelect.appendChild(option);
    }
  }

  function getExcludableLanguages(settings) {
    const disabled = new Set(settings.disabledSourceLanguages || []);
    return languagesApi.getShippedLanguages().filter((lang) => !disabled.has(lang.id));
  }

  function renderDisabledSourcePills(settings) {
    const disabledIds = settings.disabledSourceLanguages || [];
    disabledSourcePills.innerHTML = '';
    disabledSourcePills.hidden = disabledIds.length === 0;

    for (const id of disabledIds) {
      const lang = languagesApi.getLanguage(id);
      if (!lang) continue;

      const pill = document.createElement('span');
      pill.className = 'popup__pill';

      const text = document.createElement('span');
      text.className = 'popup__pill-text';
      text.textContent = formatLanguageLabel(lang);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'popup__pill-remove';
      remove.setAttribute('aria-label', `Включить ${lang.name}`);
      remove.textContent = '×';
      remove.addEventListener('click', () => removeDisabledSource(id));

      pill.append(text, remove);
      disabledSourcePills.appendChild(pill);
    }
  }

  function populateExcludeLanguageSelect(settings) {
    const previous = excludeLanguageSelect.value;
    const options = getExcludableLanguages(settings).filter(
      (lang) => lang.id !== selectionSourceLanguage
    );

    excludeLanguageSelect.innerHTML = '';
    for (const lang of options) {
      const option = document.createElement('option');
      option.value = lang.id;
      option.textContent = formatLanguageLabel(lang);
      excludeLanguageSelect.appendChild(option);
    }

    if (options.some((lang) => lang.id === previous)) {
      excludeLanguageSelect.value = previous;
    }

    const hasOptions = options.length > 0;
    excludeLanguageSelect.disabled = !hasOptions;
    excludeLanguageBtn.disabled = !hasOptions;
    excludeSelectRow.hidden = !hasOptions && Boolean(selectionSourceLanguage);
  }

  function updateExcludeCurrentRow(settings) {
    const lang = selectionSourceLanguage
      ? languagesApi.getLanguage(selectionSourceLanguage)
      : null;
    const disabled = new Set(settings.disabledSourceLanguages || []);
    const canExclude = Boolean(lang) && !disabled.has(lang.id);

    excludeCurrentRow.hidden = !canExclude;
    if (!canExclude) return;

    excludeCurrentLabel.textContent = `Сейчас: ${formatLanguageLabel(lang)}`;
    excludeCurrentBtn.disabled = false;
  }

  function renderDisabledSourcesUi(settings) {
    renderDisabledSourcePills(settings);
    updateExcludeCurrentRow(settings);
    populateExcludeLanguageSelect(settings);
  }

  async function addDisabledSource(languageId) {
    if (!languageId || !languagesApi.isShippedLanguageId(languageId)) return;
    const current = currentSettings || (await settingsApi.getSettings());
    if (current.disabledSourceLanguages.includes(languageId)) {
      renderDisabledSourcesUi(current);
      return;
    }
    const next = await settingsApi.setSettings({
      disabledSourceLanguages: [...current.disabledSourceLanguages, languageId],
    });
    applySettingsToUi(next);
  }

  async function removeDisabledSource(languageId) {
    const current = currentSettings || (await settingsApi.getSettings());
    const next = await settingsApi.setSettings({
      disabledSourceLanguages: current.disabledSourceLanguages.filter(
        (id) => id !== languageId
      ),
    });
    applySettingsToUi(next);
  }

  async function resolveSelectionSourceLanguage() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url) return null;
      const url = new URL(tab.url);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'GET_SELECTION_LANGUAGE',
      });
      const id = languagesApi.normalizeLanguageId(response?.sourceLanguage);
      return id;
    } catch {
      return null;
    }
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

  function applyChromeModelStatus(status, probe) {
    const label = pairLabel(probe.source, probe.target);
    chromeModelLabel.textContent = `Пакеты ${label}`;

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
      chromeModelHint.textContent = `Нужны для on-device перевода ${label}`;
      return;
    }

    if (status.availability === 'unavailable') {
      chromeModelValue.textContent = 'Недоступны';
      chromeModelDownload.hidden = true;
      chromeModelHint.hidden = false;
      chromeModelHint.textContent = status.error || `Пара ${label} не поддерживается`;
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

    const probe = getProbePair(currentSettings || { targetLanguage: 'en' });
    chromeModel.hidden = false;
    try {
      const status = await chrome.runtime.sendMessage({
        type: 'GET_CHROME_MODEL_STATUS',
        sourceLanguage: probe.source,
        targetLanguage: probe.target,
      });
      applyChromeModelStatus(status, probe);
    } catch (error) {
      if (!silent) {
        applyChromeModelStatus(
          {
            availability: 'unsupported',
            downloading: false,
            progress: 0,
            error: error.message,
          },
          probe
        );
      }
    }
  }

  function isHostBlocked(host, domains) {
    return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  }

  function applySiteToggle(settings) {
    if (!currentHostname) {
      siteToggle.checked = true;
      siteToggle.disabled = true;
      siteToggleHint.textContent = 'Недоступно для этой страницы';
      return;
    }

    siteToggle.disabled = false;
    siteToggle.checked = !isHostBlocked(currentHostname, settings.blockedDomains);
    siteToggleHint.textContent = currentHostname;
  }

  function applySettingsToUi(settings) {
    currentSettings = settings;
    enabledToggle.checked = settings.enabled;
    counterToggle.checked = settings.showCharCounter;
    targetLanguageSelect.value = settings.targetLanguage;
    renderDisabledSourcesUi(settings);
    providerSelect.value = settings.provider;
    applyProviderHint(settings.provider);
    chromeModel.hidden = settings.provider !== 'chrome';
    googleApiKeyField.hidden = settings.provider !== 'google';
    applySiteToggle(settings);
    if (settings.provider !== 'chrome') stopModelPoll();
  }

  async function resolveCurrentHostname() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url) return null;
      const url = new URL(tab.url);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
      return settingsApi.normalizeDomain(url.hostname) || null;
    } catch {
      return null;
    }
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
    populateTargetLanguageSelect();
    currentHostname = await resolveCurrentHostname();
    selectionSourceLanguage = await resolveSelectionSourceLanguage();
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

    targetLanguageSelect.addEventListener('change', async () => {
      const next = await settingsApi.setSettings({
        targetLanguage: targetLanguageSelect.value,
      });
      applySettingsToUi(next);
      await loadChromeModelStatus();
    });

    excludeCurrentBtn.addEventListener('click', async () => {
      if (!selectionSourceLanguage) return;
      await addDisabledSource(selectionSourceLanguage);
    });

    excludeLanguageBtn.addEventListener('click', async () => {
      await addDisabledSource(excludeLanguageSelect.value);
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

    siteToggle.addEventListener('change', async () => {
      if (!currentHostname) {
        applySiteToggle(await settingsApi.getSettings());
        return;
      }

      const current = await settingsApi.getSettings();
      let blockedDomains;

      if (siteToggle.checked) {
        blockedDomains = current.blockedDomains.filter(
          (domain) =>
            !(currentHostname === domain || currentHostname.endsWith(`.${domain}`))
        );
      } else {
        blockedDomains = current.blockedDomains.includes(currentHostname)
          ? current.blockedDomains
          : [...current.blockedDomains, currentHostname];
      }

      const next = await settingsApi.setSettings({ blockedDomains });
      applySettingsToUi(next);
    });

    chromeModelDownload.addEventListener('click', async () => {
      const probe = getProbePair(currentSettings || { targetLanguage: 'en' });
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
          sourceLanguage: probe.source,
          targetLanguage: probe.target,
        });
        applyChromeModelStatus(status, probe);
      } catch (error) {
        applyChromeModelStatus(
          {
            availability: 'downloadable',
            downloading: false,
            progress: 0,
            error: error.message,
          },
          probe
        );
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
      applyChromeModelStatus(
        message.status,
        getProbePair(currentSettings || { targetLanguage: 'en' })
      );
    });

    settingsApi.subscribe((next) => {
      applySettingsToUi(next);
      loadQuota();
      loadChromeModelStatus();
    });
  }

  init();
})();
