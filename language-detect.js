(function () {
  'use strict';

  if (window.__inputTranslateLanguageDetect) return;

  window.InputTranslate = window.InputTranslate || {};

  const CYRILLIC_RE = /[\u0400-\u04FF]/;
  const HAN_RE = /[\u4E00-\u9FFF]/;
  const ARABIC_RE = /[\u0600-\u06FF]/;
  const DEVANAGARI_RE = /[\u0900-\u097F]/;
  const LATIN_LETTER_RE = /[A-Za-z\u00C0-\u024F]/;

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

  function detectSourceLanguageFallback(text) {
    const languagesApi = window.InputTranslate.languages;
    const sample = String(text || '');
    if (!sample.trim()) return null;

    const scores = {
      ru: countMatches(sample, CYRILLIC_RE),
      zh: countMatches(sample, HAN_RE),
      ar: countMatches(sample, ARABIC_RE),
      hi: countMatches(sample, DEVANAGARI_RE),
    };

    const latinCount = countMatches(sample, LATIN_LETTER_RE);
    if (latinCount > 0) {
      const esHints = countMatches(sample, ES_HINT_RE);
      const deHints = countMatches(sample, DE_HINT_RE);
      const frHints = countMatches(sample, FR_HINT_RE);
      if (esHints >= deHints && esHints >= frHints && esHints > 0) {
        scores.es = latinCount + esHints * 3;
      } else if (deHints >= frHints && deHints > 0) {
        scores.de = latinCount + deHints * 3;
      } else if (frHints > 0) {
        scores.fr = latinCount + frHints * 3;
      } else {
        scores.en = latinCount;
      }
    }

    const shippedIds = new Set(
      (languagesApi?.getShippedLanguages() || []).map((lang) => lang.id)
    );
    let bestId = null;
    let bestScore = 0;
    for (const [id, score] of Object.entries(scores)) {
      if (!shippedIds.has(id) || score <= bestScore) continue;
      bestId = id;
      bestScore = score;
    }

    return bestScore > 0 ? bestId : null;
  }

  async function detectSourceLanguage(text) {
    const languagesApi = window.InputTranslate.languages;
    const sample = String(text || '').trim();
    if (!sample) return null;

    if (typeof chrome !== 'undefined' && chrome.i18n?.detectLanguage) {
      try {
        const result = await chrome.i18n.detectLanguage(sample);
        const languages = Array.isArray(result?.languages) ? result.languages : [];
        const ranked = [...languages].sort(
          (a, b) => (b.percentage || 0) - (a.percentage || 0)
        );
        for (const entry of ranked) {
          const id = languagesApi?.normalizeLanguageId(entry.language);
          if (id) {
            if (result?.isReliable !== false || (entry.percentage || 0) >= 50) {
              return id;
            }
          }
        }
        const top = ranked[0];
        const topId = top ? languagesApi?.normalizeLanguageId(top.language) : null;
        if (topId && (top.percentage || 0) >= 40) return topId;
      } catch {
        // fall through
      }
    }

    return detectSourceLanguageFallback(sample);
  }

  function canTranslateSource(sourceLanguage, settings) {
    if (!sourceLanguage) return false;
    const target = settings?.targetLanguage || 'en';
    if (sourceLanguage === target) return false;
    const disabled = settings?.disabledSourceLanguages || [];
    return !disabled.includes(sourceLanguage);
  }

  async function isTranslatable(context, settings) {
    const text = context?.text?.trim();
    if (!text) return false;
    const source = await detectSourceLanguage(text);
    return canTranslateSource(source, settings);
  }

  async function resolveSourceLanguage(context) {
    const text = context?.text?.trim();
    if (!text) return null;
    return detectSourceLanguage(text);
  }

  window.InputTranslate.languageDetect = {
    detectSourceLanguage,
    detectSourceLanguageFallback,
    canTranslateSource,
    isTranslatable,
    resolveSourceLanguage,
  };
  window.__inputTranslateLanguageDetect = true;
})();
