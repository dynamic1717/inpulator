/**
 * Source-language detection, best signal first:
 * 1. Chrome LanguageDetector API (on-device model, good on short phrases)
 * 2. chrome.i18n.detectLanguage (CLD3)
 * 3. Unicode script / diacritic heuristic
 *
 * Returns a registry id when the language is shipped, or a bare language code
 * (e.g. "sv") when the model is confident about a language outside the registry,
 * so such text is translated as itself instead of being mistaken for English.
 */

import { getLanguage, normalizeLanguageId } from './languages.js';

const CYRILLIC_RE = /[Ѐ-ӿ]/;
const UKRAINIAN_HINT_RE = /[ІЇЄҐіїєґ]/;
const HAN_RE = /[一-鿿]/;
const KANA_RE = /[぀-ゟ゠-ヿ]/;
const HANGUL_RE = /[가-힯ᄀ-ᇿ]/;
const ARABIC_RE = /[؀-ۿ]/;
const DEVANAGARI_RE = /[ऀ-ॿ]/;
const LATIN_LETTER_RE = /[A-Za-zÀ-ɏ]/;

/** Letters specific enough to hint at one Latin-script language. Ties go to the earlier entry. */
const LATIN_HINTS = [
  ['pt', /[ÃÕãõ]/],
  ['es', /[Ññ¿¡]/],
  ['pl', /[ĄĆĘŁŃŚŹŻąćęłńśźż]/],
  ['tr', /[ĞİŞğış]/],
  ['de', /[ÄÖÜßäöü]/],
  ['fr', /[ÀÂÇÈÊËÎÏÔÙÛŸÆŒàâçèêëîïôùûÿæœ]/],
];

/** A language outside the registry is used only when the model is this sure. */
const UNSHIPPED_MIN_CONFIDENCE = 0.7;
/** Below this, a registry language from the model is noise. */
const SHIPPED_MIN_CONFIDENCE = 0.1;

function countMatches(text, regex) {
  return (text.match(new RegExp(regex.source, `${regex.flags}g`)) || []).length;
}

/** Detectors label short Latin words as zh and similar; require the expected script. */
function languageScriptMatches(text, languageId) {
  if (languageId === 'zh' && (KANA_RE.test(text) || HANGUL_RE.test(text))) {
    return false;
  }
  const scripts = getLanguage(languageId)?.scripts;
  if (!Array.isArray(scripts) || scripts.length === 0) return true;
  return scripts.some((re) => re.test(text));
}

/** Script / diacritic heuristic when no detector is available or confident. */
export function detectSourceLanguageFallback(text) {
  const sample = String(text || '');
  if (!sample.trim()) return null;

  const kanaCount = countMatches(sample, KANA_RE);
  const hangulCount = countMatches(sample, HANGUL_RE);
  const cyrillicCount = countMatches(sample, CYRILLIC_RE);
  const scores = {
    [UKRAINIAN_HINT_RE.test(sample) ? 'uk' : 'ru']: cyrillicCount,
    zh: kanaCount === 0 && hangulCount === 0 ? countMatches(sample, HAN_RE) : 0,
    ja: kanaCount,
    ko: hangulCount,
    ar: countMatches(sample, ARABIC_RE),
    hi: countMatches(sample, DEVANAGARI_RE),
  };

  const latinCount = countMatches(sample, LATIN_LETTER_RE);
  if (latinCount > 0) {
    let hinted = 'en';
    let bestHints = 0;
    for (const [id, regex] of LATIN_HINTS) {
      const hints = countMatches(sample, regex);
      if (hints > bestHints) {
        hinted = id;
        bestHints = hints;
      }
    }
    scores[hinted] = latinCount + bestHints * 3;
  }

  let bestId = null;
  let bestScore = 0;
  for (const [id, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestId = id;
      bestScore = score;
    }
  }
  return bestId;
}

/**
 * Picks a language from LanguageDetector results (sorted by confidence).
 * @param {Array<{ detectedLanguage: string, confidence: number }>} results
 * @param {string} sample
 */
export function pickModelLanguage(results, sample) {
  for (const { detectedLanguage, confidence = 0 } of results || []) {
    const tag = String(detectedLanguage || '').toLowerCase();
    // "und" = undetermined; "-latn" = romanized text (e.g. hi-Latn) that the
    // registry languages don't cover.
    if (!tag || tag === 'und' || tag.endsWith('-latn')) continue;

    const id = normalizeLanguageId(tag);
    if (id) {
      if (confidence >= SHIPPED_MIN_CONFIDENCE && languageScriptMatches(sample, id)) {
        return id;
      }
      continue;
    }
    if (confidence >= UNSHIPPED_MIN_CONFIDENCE) return tag.split('-')[0];
  }
  return null;
}

function pickCldLanguage(result, sample) {
  const ranked = [...(Array.isArray(result?.languages) ? result.languages : [])].sort(
    (a, b) => (b.percentage || 0) - (a.percentage || 0)
  );
  for (const entry of ranked) {
    const id = normalizeLanguageId(entry.language);
    if (!id || !languageScriptMatches(sample, id)) continue;
    if (result?.isReliable !== false || (entry.percentage || 0) >= 40) return id;
  }
  return null;
}

let defaultModelDetector = null;

/** Lazily creates the on-device detector; resolves to null when it can't be used. */
function getDefaultModelDetector() {
  if (!defaultModelDetector) {
    defaultModelDetector = (async () => {
      const api = globalThis.LanguageDetector;
      if (!api) return null;
      // create() needs a user gesture while the model is still downloadable;
      // detection runs on selection changes without one, so only use it when ready.
      if ((await api.availability()) !== 'available') return null;
      return api.create();
    })().catch(() => null);
  }
  return defaultModelDetector;
}

async function defaultDetectWithModel(text) {
  const detector = await getDefaultModelDetector();
  return detector ? detector.detect(text) : null;
}

function defaultDetectWithCld(text) {
  return typeof chrome !== 'undefined' && chrome.i18n?.detectLanguage
    ? chrome.i18n.detectLanguage(text)
    : null;
}

/**
 * @param {string} text
 * @param {{
 *   detectWithModel?: (text: string) => Promise<Array<{ detectedLanguage: string, confidence: number }>|null>,
 *   detectLanguage?: (text: string) => Promise<{ isReliable?: boolean, languages?: Array<{ language: string, percentage: number }> }|null>,
 * }} [deps]
 */
export async function detectSourceLanguage(text, deps = {}) {
  const sample = String(text || '').trim();
  if (!sample) return null;

  const detectWithModel = deps.detectWithModel || defaultDetectWithModel;
  const detectLanguage = deps.detectLanguage || defaultDetectWithCld;

  try {
    const fromModel = pickModelLanguage(await detectWithModel(sample), sample);
    if (fromModel) return fromModel;
  } catch {
    // Fall through to CLD.
  }

  try {
    const fromCld = pickCldLanguage(await detectLanguage(sample), sample);
    if (fromCld) return fromCld;
  } catch {
    // Fall through to the heuristic.
  }

  return detectSourceLanguageFallback(sample);
}

export function canTranslateSource(sourceLanguage, settings) {
  if (!sourceLanguage) return false;
  const target = settings?.targetLanguage || 'en';
  if (sourceLanguage === target) return false;
  const disabled = settings?.disabledSourceLanguages || [];
  return !disabled.includes(sourceLanguage);
}
