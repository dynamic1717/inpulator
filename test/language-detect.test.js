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
