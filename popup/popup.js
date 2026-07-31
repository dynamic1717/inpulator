import { createProviderUi } from './provider.js';
import { createQuotaUi } from './quota.js';
import { createSkipLanguagesUi } from './skip-languages.js';
import { createTargetLanguageUi } from './target-language.js';

const settingsApi = window.InputTranslate.settings;
const languagesApi = window.InputTranslate.languages;

const enabledToggle = document.getElementById('enabled-toggle');
const siteToggle = document.getElementById('site-toggle');
const siteToggleHint = document.getElementById('site-toggle-hint');
const shortcutLink = document.getElementById('shortcut-link');

const state = {
  hostname: null,
  settings: null,
  selectionSourceLanguage: null,
};

const quotaUi = createQuotaUi({
  quotaLabel: document.getElementById('quota-label'),
  quotaValue: document.getElementById('quota-value'),
  quotaBar: document.getElementById('quota-bar'),
});

const providerUi = createProviderUi({
  segments: [...document.querySelectorAll('.popup__segment[data-provider]')],
  providerHint: document.getElementById('provider-hint'),
  chromeModel: document.getElementById('chrome-model'),
  chromeModelLabel: document.getElementById('chrome-model-label'),
  chromeModelValue: document.getElementById('chrome-model-value'),
  chromeModelMeter: document.getElementById('chrome-model-meter'),
  chromeModelBar: document.getElementById('chrome-model-bar'),
  chromeModelHint: document.getElementById('chrome-model-hint'),
  chromeModelDownload: document.getElementById('chrome-model-download'),
  googleApiKeyField: document.getElementById('google-api-key-field'),
  googleApiKey: document.getElementById('google-api-key'),
  googleApiKeyClear: document.getElementById('google-api-key-clear'),
  languagesApi,
  settingsApi,
  getSettings: () => state.settings,
  getSelectionSourceLanguage: () => state.selectionSourceLanguage,
  onSettingsChange: (next) => applySettingsToUi(next),
  onQuotaReload: () => quotaUi.load(),
});

const targetLanguageUi = createTargetLanguageUi({
  trigger: document.getElementById('target-language-trigger'),
  valueEl: document.getElementById('target-language-value'),
  listEl: document.getElementById('target-language-list'),
  languagesApi,
  settingsApi,
  onChange: async (next) => {
    applySettingsToUi(next);
    await providerUi.loadChromeModelStatus();
  },
});

const skipLanguagesUi = createSkipLanguagesUi({
  pillsEl: document.getElementById('disabled-source-pills'),
  suggestEl: document.getElementById('skip-suggest'),
  suggestChip: document.getElementById('skip-suggest-chip'),
  suggestText: document.getElementById('skip-suggest-text'),
  comboboxEl: document.getElementById('skip-combobox'),
  inputEl: document.getElementById('skip-language-input'),
  listEl: document.getElementById('skip-language-list'),
  languagesApi,
  settingsApi,
  getSettings: () => state.settings,
  getSelectionSourceLanguage: () => state.selectionSourceLanguage,
  onSettingsChange: (next) => applySettingsToUi(next),
});

function isHostBlocked(host, domains) {
  return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function applySiteToggle(settings) {
  if (!state.hostname) {
    siteToggle.checked = true;
    siteToggle.disabled = true;
    siteToggleHint.textContent = 'Unavailable for this page';
    return;
  }

  siteToggle.disabled = false;
  siteToggle.checked = !isHostBlocked(state.hostname, settings.blockedDomains);
  siteToggleHint.textContent = state.hostname;
}

function applySettingsToUi(settings) {
  state.settings = settings;
  enabledToggle.checked = settings.enabled;
  targetLanguageUi.apply(settings);
  skipLanguagesUi.render(settings);
  providerUi.apply(settings);
  applySiteToggle(settings);
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
    return languagesApi.normalizeLanguageId(response?.sourceLanguage);
  } catch {
    return null;
  }
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

async function init() {
  targetLanguageUi.populate();
  state.hostname = await resolveCurrentHostname();
  state.selectionSourceLanguage = await resolveSelectionSourceLanguage();
  const settings = await settingsApi.getSettings();
  applySettingsToUi(settings);
  await providerUi.loadGoogleApiKeyStatus();
  await quotaUi.load();
  await providerUi.loadChromeModelStatus();

  enabledToggle.addEventListener('change', async () => {
    const next = await settingsApi.setSettings({ enabled: enabledToggle.checked });
    applySettingsToUi(next);
  });

  siteToggle.addEventListener('change', async () => {
    if (!state.hostname) {
      applySiteToggle(await settingsApi.getSettings());
      return;
    }

    const current = await settingsApi.getSettings();
    let blockedDomains;

    if (siteToggle.checked) {
      blockedDomains = current.blockedDomains.filter(
        (domain) =>
          !(state.hostname === domain || state.hostname.endsWith(`.${domain}`))
      );
    } else {
      blockedDomains = current.blockedDomains.includes(state.hostname)
        ? current.blockedDomains
        : [...current.blockedDomains, state.hostname];
    }

    const next = await settingsApi.setSettings({ blockedDomains });
    applySettingsToUi(next);
  });

  shortcutLink.addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  });

  targetLanguageUi.bind();
  skipLanguagesUi.bind();
  providerUi.bind();

  document.addEventListener('mousedown', (event) => {
    if (!skipLanguagesUi.contains(event.target)) skipLanguagesUi.close();
    if (!targetLanguageUi.contains(event.target)) targetLanguageUi.close();
  });

  settingsApi.subscribe((next) => {
    applySettingsToUi(next);
    quotaUi.load();
    providerUi.loadChromeModelStatus();
  });
}

init();
