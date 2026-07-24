import assert from 'node:assert/strict';
import test from 'node:test';

import { createChromeProvider } from '../translation/providers/chrome-provider.js';

test('chrome provider translates via sendToOffscreen and preserves whitespace', async () => {
  const calls = [];
  const provider = createChromeProvider({
    sendToOffscreen: async (message) => {
      calls.push(message);
      return { translatedText: 'translated' };
    },
  });

  const result = await provider.translate('  тест  ');
  assert.equal(result, '  translated  ');
  assert.equal(calls[0].type, 'OFFSCREEN_TRANSLATE');
  assert.equal(calls[0].text, 'тест');
  assert.equal(calls[0].sourceLanguage, 'ru');
  assert.equal(calls[0].targetLanguage, 'en');
});

test('chrome provider forwards custom language pair', async () => {
  const calls = [];
  const provider = createChromeProvider({
    sendToOffscreen: async (message) => {
      calls.push(message);
      return { translatedText: 'hola' };
    },
  });

  await provider.translate('hello', { source: 'en', target: 'es' });
  assert.equal(calls[0].sourceLanguage, 'en');
  assert.equal(calls[0].targetLanguage, 'es');
});

test('chrome provider isAvailable checks the requested pair', async () => {
  const calls = [];
  const provider = createChromeProvider({
    sendToOffscreen: async (message) => {
      calls.push(message);
      return { availability: 'available' };
    },
  });

  assert.equal(await provider.isAvailable({ source: 'en', target: 'fr' }), true);
  assert.equal(calls[0].sourceLanguage, 'en');
  assert.equal(calls[0].targetLanguage, 'fr');
});

test('chrome provider isAvailable is true when model is downloadable', async () => {
  const provider = createChromeProvider({
    sendToOffscreen: async () => ({ availability: 'downloadable' }),
  });
  assert.equal(await provider.isAvailable(), true);
});

test('chrome provider isAvailable is true while downloading', async () => {
  const provider = createChromeProvider({
    sendToOffscreen: async () => ({ availability: 'downloading' }),
  });
  assert.equal(await provider.isAvailable(), true);
});

test('chrome provider isAvailable is false when unavailable', async () => {
  const provider = createChromeProvider({
    sendToOffscreen: async () => ({ availability: 'unavailable' }),
  });
  assert.equal(await provider.isAvailable(), false);
});

test('chrome provider quota has no limit', async () => {
  const provider = createChromeProvider({
    sendToOffscreen: async () => ({ availability: 'available' }),
  });
  const quota = await provider.getQuota();
  assert.equal(quota.period, 'none');
  assert.equal(quota.remaining, null);
  assert.equal(quota.provider, 'chrome');
});
