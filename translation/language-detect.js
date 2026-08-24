import { getLanguage, getShippedLanguages, normalizeLanguageId } from './languages.js';

const CYRILLIC_RE = /[\u0400-\u04FF]/;
const HAN_RE = /[\u4E00-\u9FFF]/;
const KANA_RE = /[\u3040-\u309F\u30A0-\u30FF]/;
const HANGUL_RE = /[\uAC00-\uD7AF\u1100-\u11FF]/;
const ARABIC_RE = /[\u0600-\u06FF]/;
const DEVANAGARI_RE = /[\u0900-\u097F]/;
const LATIN_LETTER_RE = /[A-Za-z\u00C0-\u024F]/;

const PT_HINT_RE = /[ÃÕãõ]/;
const ES_HINT_RE = /[Ññ¿¡]/;
const DE_HINT_RE = /[ÄÖÜßäöü]/;
const FR_HINT_RE = /[ÀÂÄÇÉÈÊËÎÏÔÙÛÜŸÆŒàâäçéèêëîïôùûüÿæœ]/;

function countMatches(text, regex) {
  const global = new RegExp(
    regex.source,
    regex.flags.includes('g') ? regex.flags : `${regex.flags}g`
  );
  return (text.match(global) || []).length;
}

/** CLD3 often labels short Latin words as zh/other; require the expected script. */
function languageScriptMatches(text, languageId) {
  if (languageId === 'zh' && (KANA_RE.test(text) || HANGUL_RE.test(text))) {
    return false;
  }
  const scripts = getLanguage(languageId)?.scripts;
  if (!Array.isArray(scripts) || scripts.length === 0) return true;
  return scripts.some((re) => re.test(text));
}

/** Script / diacritic heuristic when CLD is missing or unreliable. */
export function detectSourceLanguageFallback(text) {
  const sample = String(text || '');
  if (!sample.trim()) return null;

  const kanaCount = countMatches(sample, KANA_RE);
  const hangulCount = countMatches(sample, HANGUL_RE);
  const scores = {
    ru: countMatches(sample, CYRILLIC_RE),
    zh: kanaCount === 0 && hangulCount === 0 ? countMatches(sample, HAN_RE) : 0,
    ja: kanaCount,
    ko: hangulCount,
    ar: countMatches(sample, ARABIC_RE),
    hi: countMatches(sample, DEVANAGARI_RE),
  };

  const latinCount = countMatches(sample, LATIN_LETTER_RE);
  if (latinCount > 0) {
    const ptHints = countMatches(sample, PT_HINT_RE);
    const esHints = countMatches(sample, ES_HINT_RE);
    const deHints = countMatches(sample, DE_HINT_RE);
    const frHints = countMatches(sample, FR_HINT_RE);
    if (ptHints > 0 && ptHints >= esHints && ptHints >= deHints && ptHints >= frHints) {
      scores.pt = latinCount + ptHints * 3;
    } else if (esHints >= deHints && esHints >= frHints && esHints > 0) {
      scores.es = latinCount + esHints * 3;
    } else if (deHints >= frHints && deHints > 0) {
      scores.de = latinCount + deHints * 3;
    } else if (frHints > 0) {
      scores.fr = latinCount + frHints * 3;
    } else {
      scores.en = latinCount;
    }
  }

  const shippedIds = new Set(getShippedLanguages().map((lang) => lang.id));
  let bestId = null;
  let bestScore = 0;
  for (const [id, score] of Object.entries(scores)) {
    if (!shippedIds.has(id) || score <= bestScore) continue;
    bestId = id;
    bestScore = score;
  }

  return bestScore > 0 ? bestId : null;
}

/**
 * Detect source language: chrome.i18n.detectLanguage first, then fallback.
 * @param {string} text
 * @param {{ detectLanguage?: (text: string) => Promise<{ isReliable?: boolean, languages?: Array<{ language: string, percentage: number }> }> }} [deps]
 */
export async function detectSourceLanguage(text, deps = {}) {
  const sample = String(text || '').trim();
  if (!sample) return null;

  const detectFn =
    deps.detectLanguage ||
    (typeof chrome !== 'undefined' && chrome.i18n?.detectLanguage
      ? (value) => chrome.i18n.detectLanguage(value)
      : null);

  if (detectFn) {
    try {
      const result = await detectFn(sample);
      const languages = Array.isArray(result?.languages) ? result.languages : [];
      const ranked = [...languages].sort(
        (a, b) => (b.percentage || 0) - (a.percentage || 0)
      );
      for (const entry of ranked) {
        const id = normalizeLanguageId(entry.language);
        if (!id || !languageScriptMatches(sample, id)) continue;
        if (result?.isReliable !== false || (entry.percentage || 0) >= 50) {
          return id;
        }
      }
      // Unreliable but we have a mapped top hit — still prefer CLD over weak fallback
      // only when percentage is decent; otherwise fall through.
      const top = ranked.find((entry) => {
        const id = normalizeLanguageId(entry.language);
        return id && languageScriptMatches(sample, id);
      });
      const topId = top ? normalizeLanguageId(top.language) : null;
      if (topId && (top.percentage || 0) >= 40) return topId;
    } catch {
      // fall through to heuristic
    }
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
