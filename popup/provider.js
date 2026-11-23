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
  // While the popup itself drives a download, offscreen status broadcasts
  // know nothing about its progress and would reset the meter.
  let popupDownloadInProgress = false;

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

  function applyChromeModelStatus(status, probe) {
    const label = pairLabel(languagesApi, probe.source, probe.target);
    chromeModelLabel.textContent = `Packs ${label}`;

    if (!status) {
      chromeModelValue.textContent = '…';
      chromeModelMeter.hidden = true;
      chromeModelDownload.hidden = true;
      chromeModelHint.hidden = true;
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
      return;
    }

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

  async function loadChromeModelStatus() {
    if (popupDownloadInProgress) return;
    if (getSelectedProvider() !== 'chrome') {
      chromeModel.hidden = true;
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
  }

  async function selectProvider(provider) {
    const next = await settingsApi.setSettings({ provider });
    await onSettingsChange?.(next);
    await onQuotaReload?.();
    await loadChromeModelStatus();
    if (next.provider === 'google') await loadGoogleApiKeyStatus();
  }

  async function downloadPackInPopup(probe) {
    const Translator = globalThis.Translator;
    if (!Translator) return;
    const translator = await Translator.create({
      sourceLanguage: probe.source,
      targetLanguage: probe.target,
      monitor(m) {
        m.addEventListener('downloadprogress', (event) => {
          const percent = Math.round(
            Math.min(1, Math.max(0, Number(event.loaded) || 0)) * 100
          );
          chromeModelValue.textContent = `${percent}%`;
          chromeModelBar.style.width = `${percent}%`;
        });
      },
    });
    translator.destroy?.();
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
      popupDownloadInProgress = Boolean(globalThis.Translator);
      try {
        // Downloading a pack requires transient user activation, which the
        // offscreen document never has. The popup click does, so start the
        // download here; the pack is then available browser-wide.
        await downloadPackInPopup(probe);
        popupDownloadInProgress = false;
        const status = await chrome.runtime.sendMessage({
          type: 'ENSURE_CHROME_MODEL',
          sourceLanguage: probe.source,
          targetLanguage: probe.target,
        });
        applyChromeModelStatus(status, probe);
      } catch (error) {
        popupDownloadInProgress = false;
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
        popupDownloadInProgress ||
        getSelectedProvider() !== 'chrome'
      ) {
        return;
      }
      // The offscreen document broadcasts every pair it touches; show ours only.
      const probe = getProbePair(getSettings() || { targetLanguage: 'en' });
      if (
        message.sourceLanguage !== probe.source ||
        message.targetLanguage !== probe.target
      ) {
        return;
      }
      applyChromeModelStatus(message.status, probe);
    });
  }

  return {
    apply,
    bind,
    getSelectedProvider,
    loadChromeModelStatus,
    loadGoogleApiKeyStatus,
  };
}
