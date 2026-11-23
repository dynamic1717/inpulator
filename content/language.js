/** Source-language detection for selections, with a small per-text cache. */

import {
  canTranslateSource,
  detectSourceLanguage,
} from '../translation/language-detect.js';

// One selection is detected several times (gate, button label, translate);
// caching by text runs chrome.i18n.detectLanguage once per distinct text.
const CACHE_LIMIT = 50;
const cache = new Map();

export function resolveSourceLanguage(context) {
  const text = context?.text?.trim();
  if (!text) return Promise.resolve(null);

  if (cache.has(text)) {
    const cached = cache.get(text);
    cache.delete(text);
    cache.set(text, cached);
    return cached;
  }

  const pending = detectSourceLanguage(text).catch(() => null);
  cache.set(text, pending);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
  return pending;
}

export async function isTranslatable(context, settings) {
  return canTranslateSource(await resolveSourceLanguage(context), settings);
}
