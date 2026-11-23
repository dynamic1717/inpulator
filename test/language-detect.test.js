import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canTranslateSource,
  detectSourceLanguage,
  detectSourceLanguageFallback,
} from '../translation/language-detect.js';

test('fallback detects cyrillic as russian', () => {
  assert.equal(detectSourceLanguageFallback('Привет мир'), 'ru');
});

test('fallback detects han as chinese', () => {
  assert.equal(detectSourceLanguageFallback('你好世界'), 'zh');
});

test('fallback detects plain latin as english', () => {
  assert.equal(detectSourceLanguageFallback('Hello world'), 'en');
});

test('fallback prefers spanish diacritics over plain latin', () => {
  assert.equal(detectSourceLanguageFallback('¡Hola niño!'), 'es');
});

test('fallback prefers german diacritics', () => {
  assert.equal(detectSourceLanguageFallback('Schöne Größe'), 'de');
});

test('fallback prefers french diacritics', () => {
  assert.equal(detectSourceLanguageFallback('Ça été déjà'), 'fr');
});

test('fallback prefers portuguese tilde over plain latin', () => {
  assert.equal(detectSourceLanguageFallback('São Paulo'), 'pt');
});

test('fallback detects arabic', () => {
  assert.equal(detectSourceLanguageFallback('مرحبا'), 'ar');
});

test('fallback detects hindi', () => {
  assert.equal(detectSourceLanguageFallback('नमस्ते'), 'hi');
});

test('fallback detects hangul as korean', () => {
  assert.equal(detectSourceLanguageFallback('안녕하세요'), 'ko');
});

test('fallback detects kana as japanese', () => {
  assert.equal(detectSourceLanguageFallback('こんにちは'), 'ja');
});

test('fallback treats kana plus kanji as japanese not chinese', () => {
  assert.equal(detectSourceLanguageFallback('日本語です'), 'ja');
});

test('detectSourceLanguage uses CLD when reliable', async () => {
  const id = await detectSourceLanguage('bonjour', {
    detectLanguage: async () => ({
      isReliable: true,
      languages: [{ language: 'fr', percentage: 90 }],
    }),
  });
  assert.equal(id, 'fr');
});

test('detectSourceLanguage falls back when CLD fails', async () => {
  const id = await detectSourceLanguage('Привет', {
    detectLanguage: async () => {
      throw new Error('no cld');
    },
  });
  assert.equal(id, 'ru');
});

test('detectSourceLanguage ignores CLD chinese for latin-only text', async () => {
  const id = await detectSourceLanguage('stars', {
    detectLanguage: async () => ({
      isReliable: true,
      languages: [{ language: 'zh', percentage: 100 }],
    }),
  });
  assert.equal(id, 'en');
});

test('detectSourceLanguage keeps CLD chinese when han is present', async () => {
  const id = await detectSourceLanguage('你好', {
    detectLanguage: async () => ({
      isReliable: true,
      languages: [{ language: 'zh', percentage: 100 }],
    }),
  });
  assert.equal(id, 'zh');
});

test('detectSourceLanguage skips CLD chinese when kana is present', async () => {
  const id = await detectSourceLanguage('こんにちは世界', {
    detectLanguage: async () => ({
      isReliable: true,
      languages: [{ language: 'zh', percentage: 100 }],
    }),
  });
  assert.equal(id, 'ja');
});

test('detectSourceLanguage skips script-mismatched CLD hit', async () => {
  const id = await detectSourceLanguage('stars', {
    detectLanguage: async () => ({
      isReliable: true,
      languages: [
        { language: 'zh', percentage: 90 },
        { language: 'en', percentage: 10 },
      ],
    }),
  });
  assert.equal(id, 'en');
});

test('canTranslateSource respects target and disabled list', () => {
  assert.equal(
    canTranslateSource('ru', { targetLanguage: 'en', disabledSourceLanguages: [] }),
    true
  );
  assert.equal(
    canTranslateSource('en', { targetLanguage: 'en', disabledSourceLanguages: [] }),
    false
  );
  assert.equal(
    canTranslateSource('ru', {
      targetLanguage: 'en',
      disabledSourceLanguages: ['ru'],
    }),
    false
  );
});

// Results below were captured from Chrome's LanguageDetector for these phrases.
const model = (pairs) => async () =>
  pairs.map(([detectedLanguage, confidence]) => ({ detectedLanguage, confidence }));

test('model: short spanish phrase is spanish, not english', async () => {
  const detected = await detectSourceLanguage('comprobación de texto', {
    detectWithModel: model([
      ['es', 0.97],
      ['gl', 0.03],
    ]),
  });
  assert.equal(detected, 'es');
});

test('model: skips unshipped low-confidence guesses for a short russian word', async () => {
  const detected = await detectSourceLanguage('Да', {
    detectWithModel: model([
      ['sr', 0.38],
      ['bg', 0.16],
      ['ru', 0.14],
    ]),
  });
  assert.equal(detected, 'ru');
});

test('model: keeps a confident language outside the registry', async () => {
  const detected = await detectSourceLanguage('tack så mycket', {
    detectWithModel: model([
      ['sv', 0.97],
      ['da', 0.01],
    ]),
  });
  assert.equal(detected, 'sv');
});

test('model: maps script subtags and ignores romanized variants', async () => {
  assert.equal(
    await detectSourceLanguage('谢谢', { detectWithModel: model([['zh-Hans', 0.97]]) }),
    'zh'
  );
  assert.equal(
    await detectSourceLanguage('ok', {
      detectWithModel: model([
        ['hi-Latn', 0.5],
        ['en', 0.38],
      ]),
    }),
    'en'
  );
});

test('model: ukrainian is no longer folded into russian', async () => {
  const detected = await detectSourceLanguage('дякую', {
    detectWithModel: model([
      ['uk', 0.45],
      ['ru', 0.33],
    ]),
  });
  assert.equal(detected, 'uk');
});

test('model: falls back to CLD when the model has nothing usable', async () => {
  const detected = await detectSourceLanguage('Guten Morgen', {
    detectWithModel: model([['und', 1]]),
    detectLanguage: async () => ({
      isReliable: true,
      languages: [{ language: 'de', percentage: 90 }],
    }),
  });
  assert.equal(detected, 'de');
});

test('fallback detects ukrainian letters', () => {
  assert.equal(detectSourceLanguageFallback('Привіт, як справи?'), 'uk');
});

test('fallback detects polish and turkish diacritics', () => {
  assert.equal(detectSourceLanguageFallback('Dzień dobry, proszę'), 'pl');
  assert.equal(detectSourceLanguageFallback('Teşekkür ederim, nasılsın?'), 'tr');
});
