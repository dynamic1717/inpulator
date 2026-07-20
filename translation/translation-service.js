import { ENV } from '../env.js';
import { DEFAULT_LANGUAGE_PAIR } from './provider.js';
import { normalizeText } from './text-utils.js';
import { createGoogleProvider } from './providers/google-provider.js';
import { createMyMemoryProvider } from './providers/mymemory-provider.js';
import { SETTINGS_KEY, normalizeSettings } from '../settings-defaults.js';

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
    return settings.provider === PROVIDER_MYMEMORY
      ? PROVIDER_MYMEMORY
      : PROVIDER_GOOGLE;
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

  return {
    async translate(text) {
      const preferredId = await resolvePreferredId();
      const preferred = getProviderOrThrow(preferredId);

      if (preferredId === PROVIDER_MYMEMORY) {
        return translateWithProvider(preferred, text);
      }

      if (!(await preferred.isAvailable())) {
        throw new Error(
          'Google API key missing. Add GOOGLE_TRANSLATE_API_KEY to .env and run npm run env'
        );
      }

      let contentLength;
      try {
        contentLength = normalizeText(text).content.length;
      } catch {
        throw new Error('Empty text');
      }

      const googleQuota = preferred.getQuota ? await preferred.getQuota() : null;
      if (googleQuota && contentLength > googleQuota.remaining) {
        const fallback = getProviderOrThrow(PROVIDER_MYMEMORY);
        return translateWithProvider(fallback, text);
      }

      return translateWithProvider(preferred, text);
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
