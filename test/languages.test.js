import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getChromeProbePair,
  getShippedLanguageIds,
  mapLanguageCodes,
  normalizeLanguageId,
} from '../translation/languages.js';

test('normalizeLanguageId maps aliases to shipped ids', () => {
  assert.equal(normalizeLanguageId('zh-CN'), 'zh');
  assert.equal(normalizeLanguageId('ZH_TW'), 'zh');
  assert.equal(normalizeLanguageId('deu'), 'de');
  assert.equal(normalizeLanguageId('en'), 'en');
  assert.equal(normalizeLanguageId('pt-BR'), 'pt');
  assert.equal(normalizeLanguageId('jpn'), 'ja');
  assert.equal(normalizeLanguageId('ko'), 'ko');
  assert.equal(normalizeLanguageId('ar'), 'ar');
  assert.equal(normalizeLanguageId('hi'), 'hi');
});

test('normalizeLanguageId rejects unknown languages', () => {
  assert.equal(normalizeLanguageId('th'), null);
  assert.equal(normalizeLanguageId('he'), null);
});

test('mapLanguageCodes maps chinese for google and chrome', () => {
  assert.deepEqual(mapLanguageCodes('google', { source: 'ru', target: 'zh' }), {
    source: 'ru',
    target: 'zh-CN',
  });
  assert.deepEqual(mapLanguageCodes('chrome', { source: 'en', target: 'zh' }), {
    source: 'en',
    target: 'zh',
  });
  assert.deepEqual(mapLanguageCodes('mymemory', { source: 'zh', target: 'en' }), {
    source: 'zh-CN',
    target: 'en',
  });
});

test('getChromeProbePair prefers detected source language', () => {
  assert.deepEqual(getChromeProbePair('en'), { source: 'ru', target: 'en' });
  assert.deepEqual(getChromeProbePair('fr'), { source: 'en', target: 'fr' });
  assert.deepEqual(getChromeProbePair('en', 'es'), { source: 'es', target: 'en' });
  assert.deepEqual(getChromeProbePair('en', 'en'), { source: 'ru', target: 'en' });
});

test('shipped language ids include the new set', () => {
  assert.deepEqual(getShippedLanguageIds(), [
    'en',
    'ru',
    'es',
    'fr',
    'de',
    'pt',
    'zh',
    'ja',
    'ko',
    'ar',
    'hi',
  ]);
});
