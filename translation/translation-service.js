import { t } from '../i18n.js';
import { sendToOffscreen } from '../offscreen-manager.js';
import { ensureMyMemoryEmail, getApiKey, getSettings } from '../settings.js';
import { mapLanguageCodes } from './languages.js';
import { createChromeProvider } from './providers/chrome-provider.js';
import { createDeepLProvider } from './providers/deepl-provider.js';
import { createGoogleProvider } from './providers/google-provider.js';
import { createMyMemoryProvider } from './providers/mymemory-provider.js';

const PROVIDER_CHROME = 'chrome';
const PROVIDER_GOOGLE = 'google';
const PROVIDER_MYMEMORY = 'mymemory';

export function createTranslationService({ providers, getSettings } = {}) {
  if (!providers?.length)
    throw new Error('At least one translation provider is required');

  const providersById = new Map(providers.map((provider) => [provider.id, provider]));

  async function resolvePreferredId() {
    const settings = await getSettings();
    return providersById.has(settings.provider) ? settings.provider : PROVIDER_MYMEMORY;
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
    if (!sourceLanguage) throw new Error(t('errorLanguageNotDetected'));
    const settings = await getSettings();
    return { source: sourceLanguage, target: settings.targetLanguage };
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
          throw new Error(t('errorGoogleKeyMissing'));
        }
        if (preferredId === PROVIDER_CHROME) {
          throw new Error(
            t('errorChromeUnavailable', `${mappedPair.source}→${mappedPair.target}`)
          );
        }
        throw new Error(t('errorProviderUnavailable', provider.id));
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

let defaultService = null;

function getDefaultService() {
  if (!defaultService) {
    defaultService = createTranslationService({
      providers: [
        createChromeProvider({ sendToOffscreen }),
        createGoogleProvider({ getApiKey: () => getApiKey('google') }),
        createDeepLProvider({ getApiKey: () => getApiKey('deepl') }),
        createMyMemoryProvider({ getEmail: () => ensureMyMemoryEmail() }),
      ],
      getSettings: () => getSettings(),
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
