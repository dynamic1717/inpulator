import assert from 'node:assert/strict';
import test from 'node:test';

import { createTranslationService } from '../translation/translation-service.js';

function makeProviders({
  chromeAvailable = true,
  googleAvailable = true,
  googleRemaining = 500000,
} = {}) {
  let chromeCalls = 0;
  let googleCalls = 0;
  let mymemoryCalls = 0;

  const chrome = {
    id: 'chrome',
    isAvailable: async () => chromeAvailable,
    translate: async () => {
      chromeCalls += 1;
      return 'from-chrome';
    },
    getQuota: async () => ({
      charsUsed: 0,
      limit: null,
      remaining: null,
      period: 'none',
      provider: 'chrome',
    }),
  };
  const google = {
    id: 'google',
    isAvailable: async () => googleAvailable,
    translate: async () => {
      googleCalls += 1;
      return 'from-google';
    },
    getQuota: async () => ({
      charsUsed: 500000 - googleRemaining,
      limit: 500000,
      remaining: googleRemaining,
      period: 'month',
      provider: 'google',
    }),
  };
  const mymemory = {
    id: 'mymemory',
    isAvailable: async () => true,
    translate: async () => {
      mymemoryCalls += 1;
      return 'from-mymemory';
    },
    getQuota: async () => ({
      charsUsed: 10,
      limit: 50000,
      remaining: 49990,
      period: 'day',
      provider: 'mymemory',
    }),
  };

  return {
    providers: [chrome, google, mymemory],
    counts: () => ({ chromeCalls, googleCalls, mymemoryCalls }),
  };
}

test('service uses selected mymemory provider', async () => {
  const { providers } = makeProviders();
  const service = createTranslationService({
    providers,
    getSettings: async () => ({
      enabled: true,
      showCharCounter: true,
      provider: 'mymemory',
      targetLanguage: 'en',
      disabledSourceLanguages: [],
    }),
  });

  const result = await service.translate('тест', { sourceLanguage: 'ru' });
  assert.equal(result.translatedText, 'from-mymemory');
  assert.equal(result.provider, 'mymemory');
});

test('service uses chrome when selected and available', async () => {
  const { providers, counts } = makeProviders({ chromeAvailable: true });
  const service = createTranslationService({
    providers,
    getSettings: async () => ({
      enabled: true,
      showCharCounter: true,
      provider: 'chrome',
      targetLanguage: 'en',
      disabledSourceLanguages: [],
    }),
  });

  const result = await service.translate('тест', { sourceLanguage: 'ru' });
  assert.equal(result.translatedText, 'from-chrome');
  assert.equal(result.provider, 'chrome');
  assert.deepEqual(counts(), { chromeCalls: 1, googleCalls: 0, mymemoryCalls: 0 });
});

test('service does not fall back when selected chrome is unavailable', async () => {
  const { providers, counts } = makeProviders({ chromeAvailable: false });
  const service = createTranslationService({
    providers,
    getSettings: async () => ({
      enabled: true,
      showCharCounter: true,
      provider: 'chrome',
      targetLanguage: 'en',
      disabledSourceLanguages: [],
    }),
  });

  await assert.rejects(
    service.translate('тест', { sourceLanguage: 'ru' }),
    /Переводчик Chrome недоступен/
  );
  assert.deepEqual(counts(), { chromeCalls: 0, googleCalls: 0, mymemoryCalls: 0 });
});

test('service uses selected google provider even when its local quota is exhausted', async () => {
  const { providers, counts } = makeProviders({ googleRemaining: 0 });
  const service = createTranslationService({
    providers,
    getSettings: async () => ({
      enabled: true,
      showCharCounter: true,
      provider: 'google',
      targetLanguage: 'en',
      disabledSourceLanguages: [],
    }),
  });

  const result = await service.translate('тест', { sourceLanguage: 'ru' });
  assert.equal(result.translatedText, 'from-google');
  assert.equal(result.provider, 'google');
  assert.deepEqual(counts(), { chromeCalls: 0, googleCalls: 1, mymemoryCalls: 0 });
});

test('service errors when google is selected without api key', async () => {
  const { providers } = makeProviders({ googleAvailable: false });
  const service = createTranslationService({
    providers,
    getSettings: async () => ({
      enabled: true,
      showCharCounter: true,
      provider: 'google',
      targetLanguage: 'en',
      disabledSourceLanguages: [],
    }),
  });

  await assert.rejects(
    service.translate('тест', { sourceLanguage: 'ru' }),
    /Ключ Google API не найден/
  );
});

test('service passes mapped language pair to provider', async () => {
  let received = null;
  const service = createTranslationService({
    providers: [
      {
        id: 'mymemory',
        isAvailable: async () => true,
        translate: async (_text, pair) => {
          received = pair;
          return 'ok';
        },
        getQuota: async () => null,
      },
    ],
    getSettings: async () => ({
      provider: 'mymemory',
      targetLanguage: 'zh',
      disabledSourceLanguages: [],
    }),
  });

  await service.translate('hello', { sourceLanguage: 'en' });
  assert.deepEqual(received, { source: 'en', target: 'zh-CN' });
});
