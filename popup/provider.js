import { pairLabel } from './lib/format.js';

const PROVIDER_HINTS = {
  chrome: 'On-device, no API key or quota. Private and offline after packs download.',
  google: 'Sends text to Google. Needs your own API key.',
  mymemory: 'Up to 50,000 characters/day. Text is sent to MyMemory.',
};

export function createProviderUi({
  segments,
  providerHint,
  chromeModel,
  chromeModelLabel,
  chromeModelValue,
  chromeModelMeter,
  chromeModelBar,
  chromeModelHint,
  chromeModelDownload,
  googleApiKeyField,
  googleApiKey,
  googleApiKeyClear,
  languagesApi,
  settingsApi,
  getSettings,
  getSelectionSourceLanguage,
  onSettingsChange,
  onQuotaReload,
}) {
  let modelPollTimer = null;

  function getSelectedProvider() {
    const active = segments.find(
      (segment) => segment.getAttribute('aria-checked') === 'true'
    );
    return active?.dataset.provider || 'mymemory';
  }

  function setSelectedProvider(provider) {
    for (const segment of segments) {
      const selected = segment.dataset.provider === provider;
      segment.setAttribute('aria-checked', selected ? 'true' : 'false');
    }
  }

  function applyProviderHint(provider) {
    providerHint.hidden = false;
    providerHint.textContent = PROVIDER_HINTS[provider] || PROVIDER_HINTS.chrome;
  }

  function getProbePair(settings) {
    return languagesApi.getChromeProbePair(
      settings?.targetLanguage || 'en',
      getSelectionSourceLanguage()
    );
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
    const label = pairLabel(languagesApi, probe.source, probe.target);
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

    const probe = getProbePair(getSettings() || { targetLanguage: 'en' });
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

  async function loadGoogleApiKeyStatus() {
    const apiKey = await settingsApi.getGoogleApiKey();
    googleApiKey.value = '';
    googleApiKey.placeholder = apiKey ? 'Key saved' : 'Paste your Google API key';
    googleApiKeyClear.hidden = !apiKey;
  }

  function apply(settings) {
    setSelectedProvider(settings.provider);
    applyProviderHint(settings.provider);
    chromeModel.hidden = settings.provider !== 'chrome';
    googleApiKeyField.hidden = settings.provider !== 'google';
    if (settings.provider !== 'chrome') stopModelPoll();
  }

  async function selectProvider(provider) {
    const next = await settingsApi.setSettings({ provider });
    await onSettingsChange?.(next);
    await onQuotaReload?.();
    await loadChromeModelStatus();
    if (next.provider === 'google') await loadGoogleApiKeyStatus();
  }

  function bind() {
    for (const segment of segments) {
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
      await onQuotaReload?.();
    });

    googleApiKeyClear.addEventListener('click', async () => {
      await settingsApi.setGoogleApiKey('');
      await loadGoogleApiKeyStatus();
      await onQuotaReload?.();
    });

    chromeModelDownload.addEventListener('click', async () => {
      const probe = getProbePair(getSettings() || { targetLanguage: 'en' });
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
        getProbePair(getSettings() || { targetLanguage: 'en' })
      );
    });
  }

  return {
    apply,
    bind,
    getSelectedProvider,
    loadChromeModelStatus,
    loadGoogleApiKeyStatus,
    stopModelPoll,
  };
}
