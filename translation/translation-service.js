import { DEFAULT_LANGUAGE_PAIR } from './provider.js';
import { createMyMemoryProvider } from './providers/mymemory-provider.js';

export function createTranslationService({
  providers,
  languagePair = DEFAULT_LANGUAGE_PAIR,
} = {}) {
  if (!providers?.length)
    throw new Error('At least one translation provider is required');

  let activeProvider = null;

  async function isProviderAvailable(provider) {
    try {
      return await provider.isAvailable();
    } catch {
      return false;
    }
  }

  async function selectProvider() {
    if (activeProvider && (await isProviderAvailable(activeProvider))) {
      return activeProvider;
    }

    for (const provider of providers) {
      if (await isProviderAvailable(provider)) {
        activeProvider = provider;
        return provider;
      }
    }

    throw new Error('No translation provider is available');
  }

  return {
    async translate(text) {
      const provider = await selectProvider();
      const translatedText = await provider.translate(text, languagePair);
      return {
        translatedText,
        provider: provider.id,
        quota: provider.getQuota ? await provider.getQuota() : null,
      };
    },
    async getQuota() {
      const provider = await selectProvider();
      return provider.getQuota ? provider.getQuota() : null;
    },
  };
}

let defaultService = null;

function getDefaultService() {
  if (!defaultService) {
    defaultService = createTranslationService({
      providers: [createMyMemoryProvider()],
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
