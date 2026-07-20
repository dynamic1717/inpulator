import { ENV } from '../env.js';
import { sendToOffscreen } from '../offscreen-manager.js';
import { DEFAULT_LANGUAGE_PAIR } from './provider.js';
import { normalizeText } from './text-utils.js';
import { createChromeProvider } from './providers/chrome-provider.js';
import { createGoogleProvider } from './providers/google-provider.js';
import { createMyMemoryProvider } from './providers/mymemory-provider.js';
import { SETTINGS_KEY, normalizeSettings } from '../settings-defaults.js';

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
    if (settings.provider === PROVIDER_MYMEMORY) return PROVIDER_MYMEMORY;
    if (settings.provider === PROVIDER_GOOGLE) return PROVIDER_GOOGLE;
    return PROVIDER_CHROME;
  }

  function getProviderOrThrow(id) {
    const provider = providersById.get(id);
    if (!provider) throw new Error(`Unknown translation provider: ${id}`);
    return provider;
  }

  async function getSelectedProvider() {
    return getProviderOrThrow(await resolvePreferredId());
  }

  async function translateWithProvider(provider, text) {
    const translatedText = await provider.translate(text, languagePair);
    return {
      translatedText,
      provider: provider.id,
      quota: provider.getQuota ? await provider.getQuota() : null,
    };
  }

  function contentLengthOf(text) {
    try {
      return normalizeText(text).content.length;
    } catch {
      throw new Error('Empty text');
    }
  }

  async function translateWithGoogleOrMyMemory(text) {
    const google = providersById.get(PROVIDER_GOOGLE);
    const mymemory = getProviderOrThrow(PROVIDER_MYMEMORY);

    if (google && (await google.isAvailable())) {
      const contentLength = contentLengthOf(text);
      const googleQuota = google.getQuota ? await google.getQuota() : null;
      if (!googleQuota || contentLength <= googleQuota.remaining) {
        return translateWithProvider(google, text);
      }
    }

    return translateWithProvider(mymemory, text);
  }

  return {
    async translate(text) {
      const preferredId = await resolvePreferredId();

      if (preferredId === PROVIDER_MYMEMORY) {
        return translateWithProvider(getProviderOrThrow(PROVIDER_MYMEMORY), text);
      }

      if (preferredId === PROVIDER_GOOGLE) {
        const google = getProviderOrThrow(PROVIDER_GOOGLE);
        if (!(await google.isAvailable())) {
          throw new Error(
            'Google API key missing. Add GOOGLE_TRANSLATE_API_KEY to .env and run npm run env'
          );
        }
        return translateWithGoogleOrMyMemory(text);
      }

      // preferred: chrome
      const chrome = providersById.get(PROVIDER_CHROME);
      if (chrome && (await chrome.isAvailable())) {
        return translateWithProvider(chrome, text);
      }

      return translateWithGoogleOrMyMemory(text);
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

let defaultService = null;

function getDefaultService() {
  if (!defaultService) {
    defaultService = createTranslationService({
      providers: [
        createChromeProvider({ sendToOffscreen }),
        createGoogleProvider({ apiKey: ENV.GOOGLE_TRANSLATE_API_KEY }),
        createMyMemoryProvider({ email: ENV.MYMEMORY_EMAIL }),
      ],
    });
  }
  return defaultService;
}

export function translate(text) {
  return getDefaultService().translate(text);
}

export function getQuota() {
  return getDefaultService().getQuota();
}
