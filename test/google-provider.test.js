import assert from 'node:assert/strict';
import test from 'node:test';

import { createGoogleProvider } from '../translation/providers/google-provider.js';

test('google provider preserves outer whitespace and records monthly usage', async () => {
  const month = new Date().toISOString().slice(0, 7);
  let record = { month, charsUsed: 0 };
  const storage = {
    get: async () => ({ googleMonthlyUsage: { ...record } }),
    set: async (value) => {
      record = value.googleMonthlyUsage;
    },
  };
  const provider = createGoogleProvider({
    apiKey: 'test-key',
    storage,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        data: { translations: [{ translatedText: 'translated' }] },
      }),
    }),
  });

  const result = await provider.translate('  тест  ');
  assert.equal(result, '  translated  ');
  assert.equal(record.charsUsed, 4);

  const quota = await provider.getQuota();
  assert.equal(quota.period, 'month');
  assert.equal(quota.limit, 500000);
  assert.equal(quota.remaining, 500000 - 4);
  assert.equal(quota.provider, 'google');
});

test('google provider reports a timeout when the request is aborted', async () => {
  const provider = createGoogleProvider({
    apiKey: 'test-key',
    timeoutMs: 0,
    storage: {
      get: async () => ({}),
      set: async () => undefined,
    },
    fetchImpl: (_url, { signal }) =>
      new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')));
      }),
  });

  await assert.rejects(provider.translate('тест'), /timed out/);
});

test('google provider is unavailable without api key', async () => {
  const provider = createGoogleProvider({
    apiKey: '',
    storage: {
      get: async () => ({}),
      set: async () => undefined,
    },
  });
  assert.equal(await provider.isAvailable(), false);
});
