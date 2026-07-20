import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createMyMemoryProvider,
  splitIntoChunks,
} from '../translation/providers/mymemory-provider.js';

test('splitIntoChunks preserves separators between translated chunks', () => {
  assert.deepEqual(splitIntoChunks('one two three four', 8), [
    { text: 'one two', separator: ' ' },
    { text: 'three', separator: ' ' },
    { text: 'four', separator: '' },
  ]);
});

test('provider preserves outer whitespace and serializes quota updates', async () => {
  const date = new Date().toISOString().slice(0, 10);
  let record = { date, charsUsed: 0 };
  const storage = {
    get: async () => ({ dailyUsage: { ...record } }),
    set: async (value) => {
      record = value.dailyUsage;
    },
  };
  const provider = createMyMemoryProvider({
    storage,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        responseStatus: 200,
        responseData: { translatedText: 'translated' },
      }),
    }),
  });

  const [first, second] = await Promise.all([
    provider.translate('  тест  '),
    provider.translate('ещё'),
  ]);

  assert.equal(first, '  translated  ');
  assert.equal(second, 'translated');
  assert.equal(record.charsUsed, 7);
});

test('provider reports a timeout when the request is aborted', async () => {
  const provider = createMyMemoryProvider({
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

  await assert.rejects(provider.translate('тест'), /Превышено время ожидания/);
});
