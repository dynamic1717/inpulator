/** Canonical language registry and provider code mapping. */

export const LANGUAGES = Object.freeze([
  {
    id: 'en',
    name: 'English',
    flag: '🇬🇧',
    shortLabel: 'EN',
    shipped: true,
    scripts: [/[A-Za-z]/],
    providerCodes: { google: 'en', mymemory: 'en', chrome: 'en' },
  },
  {
    id: 'ru',
    name: 'Русский',
    flag: '🇷🇺',
    shortLabel: 'RU',
    shipped: true,
    scripts: [/[\u0400-\u04FF]/],
    providerCodes: { google: 'ru', mymemory: 'ru', chrome: 'ru' },
  },
  {
    id: 'es',
    name: 'Español',
    flag: '🇪🇸',
    shortLabel: 'ES',
    shipped: true,
    scripts: [/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/],
    providerCodes: { google: 'es', mymemory: 'es', chrome: 'es' },
  },
  {
    id: 'fr',
    name: 'Français',
    flag: '🇫🇷',
    shortLabel: 'FR',
    shipped: true,
    scripts: [/[A-Za-zÀÂÄÇÉÈÊËÎÏÔÙÛÜŸÆŒàâäçéèêëîïôùûüÿæœ]/],
    providerCodes: { google: 'fr', mymemory: 'fr', chrome: 'fr' },
  },
  {
    id: 'de',
    name: 'Deutsch',
    flag: '🇩🇪',
    shortLabel: 'DE',
    shipped: true,
    scripts: [/[A-Za-zÄÖÜßäöü]/],
    providerCodes: { google: 'de', mymemory: 'de', chrome: 'de' },
  },
  {
    id: 'zh',
    name: '中文',
    flag: '🇨🇳',
    shortLabel: 'ZH',
    shipped: true,
    scripts: [/[\u4E00-\u9FFF]/],
    providerCodes: { google: 'zh-CN', mymemory: 'zh-CN', chrome: 'zh' },
  },
  {
    id: 'ar',
    name: 'العربية',
    flag: '🇸🇦',
    shortLabel: 'AR',
    shipped: false,
    scripts: [/[\u0600-\u06FF]/],
    providerCodes: { google: 'ar', mymemory: 'ar', chrome: 'ar' },
  },
  {
    id: 'hi',
    name: 'हिन्दी',
    flag: '🇮🇳',
    shortLabel: 'HI',
    shipped: false,
    scripts: [/[\u0900-\u097F]/],
    providerCodes: { google: 'hi', mymemory: 'hi', chrome: 'hi' },
  },
]);

const BY_ID = new Map(LANGUAGES.map((lang) => [lang.id, lang]));

/** CLD / BCP47 tags → canonical id */
const ALIASES = Object.freeze({
  en: 'en',
  eng: 'en',
  ru: 'ru',
  rus: 'ru',
  es: 'es',
  spa: 'es',
  fr: 'fr',
  fra: 'fr',
  fre: 'fr',
  de: 'de',
  deu: 'de',
  ger: 'de',
  zh: 'zh',
  'zh-cn': 'zh',
  'zh-tw': 'zh',
  'zh-hans': 'zh',
  'zh-hant': 'zh',
  chi: 'zh',
  ar: 'ar',
  ara: 'ar',
  hi: 'hi',
  hin: 'hi',
  iw: 'he',
  he: 'he',
});

export function getLanguage(id) {
  return BY_ID.get(id) || null;
}

export function getShortLabel(id) {
  return (
    getLanguage(id)?.shortLabel ||
    String(id || '')
      .toUpperCase()
      .slice(0, 2) ||
    '??'
  );
}

export function getShippedLanguages() {
  return LANGUAGES.filter((lang) => lang.shipped);
}

export function getShippedLanguageIds() {
  return getShippedLanguages().map((lang) => lang.id);
}

export function isShippedLanguageId(id) {
  return Boolean(BY_ID.get(id)?.shipped);
}

export function normalizeLanguageId(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');
  if (!raw) return null;
  if (BY_ID.has(raw) && BY_ID.get(raw).shipped) return raw;
  const aliased = ALIASES[raw] || ALIASES[raw.split('-')[0]];
  if (aliased && BY_ID.get(aliased)?.shipped) return aliased;
  return null;
}

/** Map canonical ids to provider-specific API codes. */
export function mapLanguageCodes(providerId, { source, target }) {
  const sourceLang = getLanguage(source);
  const targetLang = getLanguage(target);
  const key =
    providerId === 'google' || providerId === 'mymemory' || providerId === 'chrome'
      ? providerId
      : 'chrome';

  return {
    source: sourceLang?.providerCodes[key] || source,
    target: targetLang?.providerCodes[key] || target,
  };
}

/** Probe pair for Chrome model status / download UI. Prefer detected source. */
export function getChromeProbePair(targetLanguage, sourceLanguage) {
  const target = isShippedLanguageId(targetLanguage) ? targetLanguage : 'en';
  let source = normalizeLanguageId(sourceLanguage);
  if (!source || source === target) {
    source = target === 'en' ? 'ru' : 'en';
  }
  return mapLanguageCodes('chrome', { source, target });
}
