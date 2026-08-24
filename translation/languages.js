/** Canonical language registry and provider code mapping. */

export const LANGUAGES = Object.freeze([
  {
    id: 'en',
    name: 'English',
    flag: 'popup/flags/gb.svg',
    shortLabel: 'EN',
    scripts: [/[A-Za-z]/],
    providerCodes: { google: 'en', mymemory: 'en', chrome: 'en' },
  },
  {
    id: 'ru',
    name: 'Русский',
    flag: 'popup/flags/ru.svg',
    shortLabel: 'RU',
    scripts: [/[\u0400-\u04FF]/],
    providerCodes: { google: 'ru', mymemory: 'ru', chrome: 'ru' },
  },
  {
    id: 'es',
    name: 'Español',
    flag: 'popup/flags/es.svg',
    shortLabel: 'ES',
    scripts: [/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/],
    providerCodes: { google: 'es', mymemory: 'es', chrome: 'es' },
  },
  {
    id: 'fr',
    name: 'Français',
    flag: 'popup/flags/fr.svg',
    shortLabel: 'FR',
    scripts: [/[A-Za-zÀÂÄÇÉÈÊËÎÏÔÙÛÜŸÆŒàâäçéèêëîïôùûüÿæœ]/],
    providerCodes: { google: 'fr', mymemory: 'fr', chrome: 'fr' },
  },
  {
    id: 'de',
    name: 'Deutsch',
    flag: 'popup/flags/de.svg',
    shortLabel: 'DE',
    scripts: [/[A-Za-zÄÖÜßäöü]/],
    providerCodes: { google: 'de', mymemory: 'de', chrome: 'de' },
  },
  {
    id: 'pt',
    name: 'Português',
    flag: 'popup/flags/pt.svg',
    shortLabel: 'PT',
    scripts: [/[A-Za-zÁÀÂÃÉÊÍÓÔÕÚÜÇáàâãéêíóôõúüç]/],
    providerCodes: { google: 'pt', mymemory: 'pt', chrome: 'pt' },
  },
  {
    id: 'zh',
    name: '中文',
    flag: 'popup/flags/cn.svg',
    shortLabel: 'ZH',
    scripts: [/[\u4E00-\u9FFF]/],
    providerCodes: { google: 'zh-CN', mymemory: 'zh-CN', chrome: 'zh' },
  },
  {
    id: 'ja',
    name: '日本語',
    flag: 'popup/flags/jp.svg',
    shortLabel: 'JA',
    scripts: [/[\u3040-\u309F\u30A0-\u30FF]/],
    providerCodes: { google: 'ja', mymemory: 'ja', chrome: 'ja' },
  },
  {
    id: 'ko',
    name: '한국어',
    flag: 'popup/flags/kr.svg',
    shortLabel: 'KO',
    scripts: [/[\uAC00-\uD7AF\u1100-\u11FF]/],
    providerCodes: { google: 'ko', mymemory: 'ko', chrome: 'ko' },
  },
  {
    id: 'ar',
    name: 'العربية',
    flag: 'popup/flags/sa.svg',
    shortLabel: 'AR',
    scripts: [/[\u0600-\u06FF]/],
    providerCodes: { google: 'ar', mymemory: 'ar', chrome: 'ar' },
  },
  {
    id: 'hi',
    name: 'हिन्दी',
    flag: 'popup/flags/in.svg',
    shortLabel: 'HI',
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
  pt: 'pt',
  por: 'pt',
  'pt-br': 'pt',
  'pt-pt': 'pt',
  zh: 'zh',
  'zh-cn': 'zh',
  'zh-tw': 'zh',
  'zh-hans': 'zh',
  'zh-hant': 'zh',
  chi: 'zh',
  ja: 'ja',
  jpn: 'ja',
  jp: 'ja',
  ko: 'ko',
  kor: 'ko',
  kr: 'ko',
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
  return LANGUAGES;
}

export function getShippedLanguageIds() {
  return LANGUAGES.map((lang) => lang.id);
}

export function isShippedLanguageId(id) {
  return BY_ID.has(id);
}

export function normalizeLanguageId(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');
  if (!raw) return null;
  if (BY_ID.has(raw)) return raw;
  const aliased = ALIASES[raw] || ALIASES[raw.split('-')[0]];
  if (aliased && BY_ID.has(aliased)) return aliased;
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
