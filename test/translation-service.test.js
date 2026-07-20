import assert from 'node:assert/strict';
import test from 'node:test';

import { createTranslationService } from '../translation/translation-service.js';

test('service uses selected mymemory provider', async () => {
  const google = {
    id: 'google',
    isAvailable: async () => true,
    translate: async () => 'from-google',
    getQuota: async () => ({
      charsUsed: 0,
      limit: 500000,
      remaining: 500000,
      period: 'month',
      provider: 'google',
    }),
  };
  const mymemory = {
    id: 'mymemory',
    isAvailable: async () => true,
    translate: async () => 'from-mymemory',
    getQuota: async () => ({
      charsUsed: 1,
      limit: 50000,
      remaining: 49999,
      period: 'day',
      provider: 'mymemory',
    }),
  };
  const service = createTranslationService({
    providers: [google, mymemory],
    getSettings: async () => ({
      enabled: true,
      showCharCounter: true,
      provider: 'mymemory',
    }),
  });

  assert.deepEqual(await service.translate('тест'), {
    translatedText: 'from-mymemory',
    provider: 'mymemory',
    quota: {
      charsUsed: 1,
      limit: 50000,
      remaining: 49999,
      period: 'day',
      provider: 'mymemory',
    },
  });
});

test('service falls back to mymemory when google quota is exhausted', async () => {
  let googleTranslateCalls = 0;
  let mymemoryTranslateCalls = 0;

  const google = {
    id: 'google',
    isAvailable: async () => true,
    translate: async () => {
      googleTranslateCalls += 1;
      return 'from-google';
    },
    getQuota: async () => ({
      charsUsed: 500000,
      limit: 500000,
      remaining: 0,
      period: 'month',
      provider: 'google',
    }),
  };
  const mymemory = {
    id: 'mymemory',
    isAvailable: async () => true,
    translate: async () => {
      mymemoryTranslateCalls += 1;
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
  const service = createTranslationService({
    providers: [google, mymemory],
    getSettings: async () => ({
      enabled: true,
      showCharCounter: true,
      provider: 'google',
    }),
  });

  const result = await service.translate('тест');
  assert.equal(result.translatedText, 'from-mymemory');
  assert.equal(result.provider, 'mymemory');
  assert.equal(googleTranslateCalls, 0);
  assert.equal(mymemoryTranslateCalls, 1);
});

test('service errors when google is selected without api key', async () => {
  const google = {
    id: 'google',
    isAvailable: async () => false,
    translate: async () => 'from-google',
    getQuota: async () => ({
      charsUsed: 0,
      limit: 500000,
      remaining: 500000,
      period: 'month',
      provider: 'google',
    }),
  };
  const mymemory = {
    id: 'mymemory',
    isAvailable: async () => true,
    translate: async () => 'from-mymemory',
    getQuota: async () => ({
      charsUsed: 0,
      limit: 50000,
      remaining: 50000,
      period: 'day',
      provider: 'mymemory',
    }),
  };
  const service = createTranslationService({
    providers: [google, mymemory],
    getSettings: async () => ({
      enabled: true,
      showCharCounter: true,
      provider: 'google',
    }),
  });

  await assert.rejects(service.translate('тест'), /Google API key missing/);
});
