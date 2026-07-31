import { sendToOffscreen } from '../offscreen-manager.js';
import { DEFAULT_LANGUAGE_PAIR } from './provider.js';
import { mapLanguageCodes } from './languages.js';
import { createChromeProvider } from './providers/chrome-provider.js';
import { createGoogleProvider } from './providers/google-provider.js';
import { createMyMemoryProvider } from './providers/mymemory-provider.js';
import {
  GOOGLE_API_KEY_STORAGE_KEY,
  SETTINGS_KEY,
  ensureMyMemoryEmail,
  normalizeSettings,
} from '../settings-defaults.js';

const PROVIDER_CHROME = 'chrome';
const PROVIDER_GOOGLE = 'google';
const PROVIDER_MYMEMORY = 'mymemory';

export function createTranslationService({
  providers,
  languagePair = DEFAULT_LANGUAGE_PAIR,
  getSettings = defaultGetSettings,
} = {}) {
  if (!providers?.length)
    throw new Error('At least one translation provider is required');

  const providersById = new Map(providers.map((provider) => [provider.id, provider]));

  async function resolvePreferredId() {
    const settings = await getSettings();
    if (settings.provider === PROVIDER_CHROME) return PROVIDER_CHROME;
    if (settings.provider === PROVIDER_GOOGLE) return PROVIDER_GOOGLE;
    return PROVIDER_MYMEMORY;
  }

  function getProviderOrThrow(id) {
    const provider = providersById.get(id);
    if (!provider) throw new Error(`Unknown translation provider: ${id}`);
    return provider;
  }

  async function getSelectedProvider() {
    return getProviderOrThrow(await resolvePreferredId());
  }

  async function resolveLanguagePair(sourceLanguage) {
    const settings = await getSettings();
    const source = sourceLanguage || languagePair.source;
    const target = settings.targetLanguage || languagePair.target;
    return { source, target };
  }

  async function translateWithProvider(provider, text, pair) {
    const mapped = mapLanguageCodes(provider.id, pair);
    const translatedText = await provider.translate(text, mapped);
    return {
      translatedText,
      provider: provider.id,
      quota: provider.getQuota ? await provider.getQuota() : null,
    };
  }

  return {
    async translate(text, { sourceLanguage } = {}) {
      const preferredId = await resolvePreferredId();
      const provider = getProviderOrThrow(preferredId);
      const pair = await resolveLanguagePair(sourceLanguage);
      const mappedPair = mapLanguageCodes(preferredId, pair);

      const available =
        typeof provider.isAvailable === 'function'
          ? await provider.isAvailable(mappedPair)
          : true;

      if (!available) {
        if (preferredId === PROVIDER_GOOGLE) {
          throw new Error(
            'Google API key not found. Add it in the extension settings.'
          );
        }
        if (preferredId === PROVIDER_CHROME) {
          throw new Error(
            `Chrome Translator is unavailable. Download the ${mappedPair.source}→${mappedPair.target} pack or choose another provider.`
          );
        }
        throw new Error(`Provider ${provider.id} is unavailable`);
      }

      return translateWithProvider(provider, text, pair);
    },
    async getQuota() {
      const provider = await getSelectedProvider();
      if (!provider.getQuota) return null;
      return provider.getQuota();
    },
  };
}

async function defaultGetSettings() {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return normalizeSettings(null);
  }
  const data = await chrome.storage.local.get(SETTINGS_KEY);
  return normalizeSettings(data[SETTINGS_KEY]);
}

async function getGoogleApiKey() {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return '';
  const data = await chrome.storage.local.get(GOOGLE_API_KEY_STORAGE_KEY);
  return String(data[GOOGLE_API_KEY_STORAGE_KEY] || '').trim();
}

async function getMyMemoryEmail() {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return '';
  return ensureMyMemoryEmail(chrome.storage.local);
}

let defaultService = null;

function getDefaultService() {
  if (!defaultService) {
    defaultService = createTranslationService({
      providers: [
        createChromeProvider({ sendToOffscreen }),
        createGoogleProvider({ getApiKey: getGoogleApiKey }),
        createMyMemoryProvider({ getEmail: getMyMemoryEmail }),
      ],
    });
  }
  return defaultService;
}

export function translate(text, options) {
  return getDefaultService().translate(text, options);
}

export function getQuota() {
  return getDefaultService().getQuota();
}
