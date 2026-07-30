(function () {
  'use strict';

  const settingsApi = window.InputTranslate.settings;
  const languagesApi = window.InputTranslate.languages;
  const enabledToggle = document.getElementById('enabled-toggle');
  const targetLanguageTrigger = document.getElementById('target-language-trigger');
  const targetLanguageValue = document.getElementById('target-language-value');
  const targetLanguageList = document.getElementById('target-language-list');
  const disabledSourcePills = document.getElementById('disabled-source-pills');
  const skipSuggest = document.getElementById('skip-suggest');
  const skipSuggestChip = document.getElementById('skip-suggest-chip');
  const skipSuggestText = document.getElementById('skip-suggest-text');
  const skipCombobox = document.getElementById('skip-combobox');
  const skipLanguageInput = document.getElementById('skip-language-input');
  const skipLanguageList = document.getElementById('skip-language-list');
  const providerSegments = [
    ...document.querySelectorAll('.popup__segment[data-provider]'),
  ];
  const providerHint = document.getElementById('provider-hint');
  const quotaLabel = document.getElementById('quota-label');
  const quotaValue = document.getElementById('quota-value');
  const quotaBar = document.getElementById('quota-bar');
  const chromeModel = document.getElementById('chrome-model');
  const chromeModelLabel = document.getElementById('chrome-model-label');
  const chromeModelValue = document.getElementById('chrome-model-value');
  const chromeModelMeter = document.getElementById('chrome-model-meter');
  const chromeModelBar = document.getElementById('chrome-model-bar');
  const chromeModelHint = document.getElementById('chrome-model-hint');
  const chromeModelDownload = document.getElementById('chrome-model-download');
  const googleApiKeyField = document.getElementById('google-api-key-field');
  const googleApiKey = document.getElementById('google-api-key');
  const googleApiKeyClear = document.getElementById('google-api-key-clear');
  const siteToggle = document.getElementById('site-toggle');
  const siteToggleHint = document.getElementById('site-toggle-hint');
  const shortcutLink = document.getElementById('shortcut-link');

  let currentHostname = null;
  let currentSettings = null;
  let selectionSourceLanguage = null;
  let selectedTargetLanguage = 'en';
  let targetListOpen = false;
  let targetHighlightIndex = -1;
  let skipHighlightIndex = -1;
  let skipListOpen = false;

  const PROVIDER_HINTS = {
    chrome: 'On-device, no API key or quota. Private and offline after packs download.',
    google: 'Sends text to Google. Needs your own API key.',
    mymemory: 'Up to 50,000 characters/day. Text is sent to MyMemory.',
  };

  function getSelectedProvider() {
    const active = providerSegments.find(
      (segment) => segment.getAttribute('aria-checked') === 'true'
    );
    return active?.dataset.provider || 'mymemory';
  }

  function setSelectedProvider(provider) {
    for (const segment of providerSegments) {
      const selected = segment.dataset.provider === provider;
      segment.setAttribute('aria-checked', selected ? 'true' : 'false');
    }
  }

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

  function setTargetLanguageDisplay(languageId) {
    selectedTargetLanguage = languageId;
    const lang = languagesApi.getLanguage(languageId);
    targetLanguageValue.textContent = lang ? formatLanguageLabel(lang) : languageId;
  }

  function updateTargetHighlight(options) {
    for (let i = 0; i < options.length; i += 1) {
      options[i].setAttribute(
        'aria-selected',
        i === targetHighlightIndex ? 'true' : 'false'
      );
    }
    options[targetHighlightIndex]?.scrollIntoView({ block: 'nearest' });
  }

  function setTargetListOpen(open) {
    targetListOpen = open;
    targetLanguageList.hidden = !open;
    targetLanguageTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (!open) {
      targetHighlightIndex = -1;
      for (const option of targetLanguageList.querySelectorAll(
        '.popup__combobox-option'
      )) {
        option.setAttribute(
          'aria-selected',
          option.dataset.languageId === selectedTargetLanguage ? 'true' : 'false'
        );
      }
    }
  }

  async function chooseTargetLanguage(languageId) {
    if (!languageId || languageId === selectedTargetLanguage) {
      setTargetListOpen(false);
      return;
    }
    const next = await settingsApi.setSettings({ targetLanguage: languageId });
    applySettingsToUi(next);
    setTargetListOpen(false);
    await loadChromeModelStatus();
  }

  function populateTargetLanguageList() {
    targetLanguageList.innerHTML = '';
    const languages = languagesApi.getShippedLanguages();

    languages.forEach((lang, index) => {
      const item = document.createElement('li');
      item.className = 'popup__combobox-option';
      item.setAttribute('role', 'option');
      item.dataset.languageId = lang.id;
      item.textContent = formatLanguageLabel(lang);
      item.setAttribute(
        'aria-selected',
        lang.id === selectedTargetLanguage ? 'true' : 'false'
      );
      item.addEventListener('mousedown', (event) => {
        event.preventDefault();
      });
      item.addEventListener('click', () => {
        chooseTargetLanguage(lang.id);
      });
      item.addEventListener('mouseenter', () => {
        targetHighlightIndex = index;
        updateTargetHighlight([...targetLanguageList.children]);
      });
      targetLanguageList.appendChild(item);
    });
  }

  function openTargetLanguageList() {
    populateTargetLanguageList();
    const options = [...targetLanguageList.children];
    targetHighlightIndex = Math.max(
      0,
      options.findIndex(
        (option) => option.dataset.languageId === selectedTargetLanguage
      )
    );
    setTargetListOpen(true);
    updateTargetHighlight(options);
  }

  function getExcludableLanguages(settings, query = '') {
    const disabled = new Set(settings.disabledSourceLanguages || []);
    const needle = String(query || '')
      .trim()
      .toLowerCase();
    return languagesApi.getShippedLanguages().filter((lang) => {
      if (disabled.has(lang.id)) return false;
      if (!needle) return true;
      const haystack = [lang.name, lang.shortLabel, lang.id]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }

  function renderDisabledSourcePills(settings) {
    const disabledIds = settings.disabledSourceLanguages || [];
    disabledSourcePills.innerHTML = '';

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
      remove.setAttribute('aria-label', `Enable ${lang.name}`);
      remove.textContent = '×';
      remove.addEventListener('click', (event) => {
        event.stopPropagation();
        removeDisabledSource(id);
      });

      pill.append(text, remove);
      disabledSourcePills.appendChild(pill);
    }
  }

  function renderSkipSuggest(settings) {
    const lang = selectionSourceLanguage
      ? languagesApi.getLanguage(selectionSourceLanguage)
      : null;
    const disabled = new Set(settings.disabledSourceLanguages || []);
    const canSuggest = Boolean(lang) && !disabled.has(lang.id);

    skipSuggest.hidden = !canSuggest;
    if (!canSuggest) return;

    skipSuggestText.textContent = formatLanguageLabel(lang);
    skipSuggestChip.setAttribute('aria-label', `Skip ${lang.name}`);
  }

  function setSkipListOpen(open) {
    skipListOpen = open;
    skipLanguageList.hidden = !open;
    skipLanguageInput.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (!open) {
      skipHighlightIndex = -1;
      for (const option of skipLanguageList.querySelectorAll(
        '.popup__combobox-option'
      )) {
        option.setAttribute('aria-selected', 'false');
      }
    }
  }

  function updateSkipHighlight(options) {
    for (let i = 0; i < options.length; i += 1) {
      options[i].setAttribute(
        'aria-selected',
        i === skipHighlightIndex ? 'true' : 'false'
      );
    }
    options[skipHighlightIndex]?.scrollIntoView({ block: 'nearest' });
  }

  function renderSkipLanguageList(settings) {
    const options = getExcludableLanguages(settings, skipLanguageInput.value);
    skipLanguageList.innerHTML = '';

    for (const lang of options) {
      const item = document.createElement('li');
      item.className = 'popup__combobox-option';
      item.setAttribute('role', 'option');
      item.dataset.languageId = lang.id;
      item.textContent = formatLanguageLabel(lang);
      item.addEventListener('mousedown', (event) => {
        event.preventDefault();
      });
      item.addEventListener('click', async () => {
        await addDisabledSource(lang.id);
        skipLanguageInput.value = '';
        setSkipListOpen(false);
        skipLanguageInput.focus();
      });
      skipLanguageList.appendChild(item);
    }

    if (options.length === 0) {
      skipHighlightIndex = -1;
      setSkipListOpen(false);
      return options;
    }

    if (skipHighlightIndex >= options.length) {
      skipHighlightIndex = options.length - 1;
    }
    if (skipListOpen && skipHighlightIndex < 0) {
      skipHighlightIndex = 0;
    }
    updateSkipHighlight([...skipLanguageList.children]);
    return options;
  }

  function openSkipLanguageList() {
    const settings = currentSettings || { disabledSourceLanguages: [] };
    const options = renderSkipLanguageList(settings);
    if (options.length === 0) {
      setSkipListOpen(false);
      return;
    }
    if (skipHighlightIndex < 0) skipHighlightIndex = 0;
    setSkipListOpen(true);
    updateSkipHighlight([...skipLanguageList.children]);
  }

  function renderSkipLanguagesUi(settings) {
    renderDisabledSourcePills(settings);
    renderSkipSuggest(settings);
    if (skipListOpen) renderSkipLanguageList(settings);
  }

  async function addDisabledSource(languageId) {
    if (!languageId || !languagesApi.isShippedLanguageId(languageId)) return;
    const current = currentSettings || (await settingsApi.getSettings());
    if (current.disabledSourceLanguages.includes(languageId)) {
      renderSkipLanguagesUi(current);
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
    return Number(value).toLocaleString('en-US');
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
    chromeModelLabel.textContent = `Packs ${label}`;

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
      chromeModelHint.textContent = 'Downloading language packs…';
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
      chromeModelValue.textContent = 'Not downloaded';
      chromeModelDownload.hidden = false;
      chromeModelDownload.disabled = false;
      chromeModelHint.hidden = false;
      chromeModelHint.textContent = `Required for on-device translation ${label}`;
      return;
    }

    if (status.availability === 'unavailable') {
      chromeModelValue.textContent = 'Unavailable';
      chromeModelDownload.hidden = true;
      chromeModelHint.hidden = false;
      chromeModelHint.textContent = status.error || `Pair ${label} is not supported`;
      return;
    }

    chromeModelValue.textContent = 'No API';
    chromeModelDownload.hidden = true;
    chromeModelHint.hidden = false;
    chromeModelHint.textContent =
      status.error || 'Needs Chrome 138+ (desktop) with Translator API';
  }

  async function loadChromeModelStatus({ silent = false } = {}) {
    if (getSelectedProvider() !== 'chrome') {
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
      siteToggleHint.textContent = 'Unavailable for this page';
      return;
    }

    siteToggle.disabled = false;
    siteToggle.checked = !isHostBlocked(currentHostname, settings.blockedDomains);
    siteToggleHint.textContent = currentHostname;
  }

  function applySettingsToUi(settings) {
    currentSettings = settings;
    enabledToggle.checked = settings.enabled;
    setTargetLanguageDisplay(settings.targetLanguage);
    populateTargetLanguageList();
    renderSkipLanguagesUi(settings);
    setSelectedProvider(settings.provider);
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
    googleApiKey.placeholder = apiKey ? 'Key saved' : 'Paste your Google API key';
    googleApiKeyClear.hidden = !apiKey;
  }

  async function loadQuota() {
    try {
      const quota = await chrome.runtime.sendMessage({ type: 'GET_QUOTA' });

      if (quota?.period === 'none' || quota?.limit == null) {
        quotaLabel.textContent = 'Limit';
        quotaValue.textContent = 'No limit';
        quotaBar.style.width = '0%';
        return;
      }

      const used = quota?.charsUsed ?? 0;
      const limit = quota?.limit ?? quota?.dailyLimit ?? 0;
      quotaLabel.textContent =
        quota?.period === 'day' ? 'Used today' : 'Used this month';
      quotaValue.textContent = `${formatCount(used)} / ${formatCount(limit)}`;
      const percent = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
      quotaBar.style.width = `${percent}%`;
    } catch {
      quotaLabel.textContent = 'Used';
      quotaValue.textContent = '… / …';
      quotaBar.style.width = '0%';
    }
  }

  async function selectProvider(provider) {
    const next = await settingsApi.setSettings({ provider });
    applySettingsToUi(next);
    await loadQuota();
    await loadChromeModelStatus();
    if (next.provider === 'google') await loadGoogleApiKeyStatus();
  }

  async function init() {
    populateTargetLanguageList();
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

    targetLanguageTrigger.addEventListener('click', () => {
      if (targetListOpen) {
        setTargetListOpen(false);
        return;
      }
      openTargetLanguageList();
    });

    targetLanguageTrigger.addEventListener('keydown', async (event) => {
      const options = [...targetLanguageList.children];

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (!targetListOpen) {
          openTargetLanguageList();
          return;
        }
        if (options.length === 0) return;
        targetHighlightIndex = (targetHighlightIndex + 1) % options.length;
        updateTargetHighlight(options);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (!targetListOpen) {
          openTargetLanguageList();
          return;
        }
        if (options.length === 0) return;
        targetHighlightIndex =
          targetHighlightIndex <= 0 ? options.length - 1 : targetHighlightIndex - 1;
        updateTargetHighlight(options);
        return;
      }

      if (event.key === 'Enter' || event.key === ' ') {
        if (!targetListOpen) return;
        event.preventDefault();
        const languageId = options[targetHighlightIndex]?.dataset.languageId;
        if (languageId) await chooseTargetLanguage(languageId);
        return;
      }

      if (event.key === 'Escape' && targetListOpen) {
        event.preventDefault();
        setTargetListOpen(false);
      }
    });

    skipSuggestChip.addEventListener('click', async () => {
      if (!selectionSourceLanguage) return;
      await addDisabledSource(selectionSourceLanguage);
    });

    skipCombobox.addEventListener('click', () => {
      skipLanguageInput.focus();
    });

    skipLanguageInput.addEventListener('focus', () => {
      openSkipLanguageList();
    });

    skipLanguageInput.addEventListener('input', () => {
      openSkipLanguageList();
    });

    skipLanguageInput.addEventListener('keydown', async (event) => {
      const options = [...skipLanguageList.querySelectorAll('.popup__combobox-option')];

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (!skipListOpen) openSkipLanguageList();
        if (options.length === 0) return;
        skipHighlightIndex = (skipHighlightIndex + 1) % options.length;
        updateSkipHighlight(options);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (!skipListOpen) openSkipLanguageList();
        if (options.length === 0) return;
        skipHighlightIndex =
          skipHighlightIndex <= 0 ? options.length - 1 : skipHighlightIndex - 1;
        updateSkipHighlight(options);
        return;
      }

      if (event.key === 'Enter') {
        if (!skipListOpen || skipHighlightIndex < 0 || !options[skipHighlightIndex]) {
          return;
        }
        event.preventDefault();
        const languageId = options[skipHighlightIndex].dataset.languageId;
        await addDisabledSource(languageId);
        skipLanguageInput.value = '';
        setSkipListOpen(false);
        return;
      }

      if (event.key === 'Escape') {
        if (!skipListOpen) return;
        event.preventDefault();
        setSkipListOpen(false);
        return;
      }

      if (
        event.key === 'Backspace' &&
        !skipLanguageInput.value &&
        (currentSettings?.disabledSourceLanguages || []).length > 0
      ) {
        const disabled = currentSettings.disabledSourceLanguages;
        await removeDisabledSource(disabled[disabled.length - 1]);
      }
    });

    skipLanguageInput.addEventListener('blur', () => {
      setTimeout(() => {
        if (
          document.activeElement === skipLanguageInput ||
          skipLanguageList.contains(document.activeElement)
        ) {
          return;
        }
        setSkipListOpen(false);
      }, 0);
    });

    document.addEventListener('mousedown', (event) => {
      if (
        !skipCombobox.contains(event.target) &&
        !skipLanguageList.contains(event.target)
      ) {
        setSkipListOpen(false);
      }

      if (
        !targetLanguageTrigger.contains(event.target) &&
        !targetLanguageList.contains(event.target)
      ) {
        setTargetListOpen(false);
      }
    });

    for (const segment of providerSegments) {
      segment.addEventListener('click', async () => {
        const provider = segment.dataset.provider;
        if (!provider || provider === getSelectedProvider()) return;
        await selectProvider(provider);
      });
    }

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

    shortcutLink.addEventListener('click', () => {
      chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    });

    chromeModelDownload.addEventListener('click', async () => {
      const probe = getProbePair(currentSettings || { targetLanguage: 'en' });
      chromeModelDownload.disabled = true;
      chromeModelValue.textContent = '0%';
      chromeModelMeter.hidden = false;
      chromeModelBar.style.width = '0%';
      chromeModelHint.hidden = false;
      chromeModelHint.textContent = 'Downloading language packs…';
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
        chromeModelHint.textContent = error.message || 'Failed to download packs';
        chromeModelDownload.hidden = false;
        chromeModelDownload.disabled = false;
      }
    });

    chrome.runtime.onMessage.addListener((message) => {
      if (
        message?.type !== 'CHROME_MODEL_STATUS' ||
        getSelectedProvider() !== 'chrome'
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
