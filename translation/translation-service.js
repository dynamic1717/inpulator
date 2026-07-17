import { DEFAULT_LANGUAGE_PAIR } from './provider.js';
import { createMyMemoryProvider } from './providers/mymemory-provider.js';

// Add Chrome Translator here in the next phase; callers remain provider-agnostic.
const provider = createMyMemoryProvider();

export async function translate(text) {
  const translatedText = await provider.translate(text, DEFAULT_LANGUAGE_PAIR);
  return {
    translatedText,
    provider: provider.id,
    quota: await provider.getQuota(),
  };
}

export function getQuota() {
  return provider.getQuota();
}
