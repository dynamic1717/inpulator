import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDeepLProvider,
  getDeepLBaseUrl,
  toDeepLCodes,
} from '../translation/providers/deepl-provider.js';

function memoryStorage() {
  const data = {};
  return {
    get: async (key) => ({ [key]: data[key] }),
    set: async (value) => Object.assign(data, value),
  };
}

test('free keys use api-free, others the pro host', () => {
  assert.equal(getDeepLBaseUrl('abc:fx'), 'https://api-free.deepl.com');
  assert.equal(getDeepLBaseUrl('abc'), 'https://api.deepl.com');
});

test('target codes get the variants DeepL expects', () => {
  assert.deepEqual(toDeepLCodes({ source: 'en', target: 'pt' }), {
    source: 'EN',
    target: 'PT-BR',
  });
  assert.deepEqual(toDeepLCodes({ source: 'zh', target: 'en' }), {
    source: 'ZH',
    target: 'EN-US',
  });
  assert.deepEqual(toDeepLCodes({ source: 'ru', target: 'de' }), {
    source: 'RU',
    target: 'DE',
  });
});

test('translates with the auth header and keeps outer whitespace', async () => {
  const calls = [];
  const provider = createDeepLProvider({
    storage: memoryStorage(),
    getApiKey: async () => 'key:fx',
    hasHostPermission: async () => true,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        json: async () => ({ translations: [{ text: 'Hallo Welt' }] }),
      };
    },
  });

  const result = await provider.translate('  Привет мир  ', {
    source: 'ru',
    target: 'de',
  });

  assert.equal(result, '  Hallo Welt  ');
  assert.equal(calls[0].url, 'https://api-free.deepl.com/v2/translate');
  assert.equal(calls[0].init.headers.Authorization, 'DeepL-Auth-Key key:fx');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    text: ['Привет мир'],
    source_lang: 'RU',
    target_lang: 'DE',
    preserve_formatting: true,
  });
});

test('explains missing key, missing permission and quota errors', async () => {
  const base = { storage: memoryStorage(), hasHostPermission: async () => true };
  const pair = { source: 'ru', target: 'en' };

  await assert.rejects(
    createDeepLProvider({ ...base, getApiKey: async () => '' }).translate(
      'Привет',
      pair
    ),
    /DeepL API key not found/
  );
  await assert.rejects(
    createDeepLProvider({
      ...base,
      getApiKey: async () => 'k:fx',
      hasHostPermission: async () => false,
    }).translate('Привет', pair),
    /Allow access to DeepL/
  );
  await assert.rejects(
    createDeepLProvider({
      ...base,
      getApiKey: async () => 'k:fx',
      fetchImpl: async () => ({ ok: false, status: 456, json: async () => ({}) }),
    }).translate('Привет', pair),
    /quota/
  );
});

test('quota comes from /v2/usage and falls back to a local estimate', async () => {
  const withUsage = createDeepLProvider({
    storage: memoryStorage(),
    getApiKey: async () => 'k:fx',
    hasHostPermission: async () => true,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ character_count: 1200, character_limit: 500000 }),
    }),
  });
  assert.deepEqual(await withUsage.getQuota(), {
    charsUsed: 1200,
    limit: 500000,
    remaining: 498800,
    period: 'month',
    provider: 'deepl',
  });

  const offline = createDeepLProvider({
    storage: memoryStorage(),
    getApiKey: async () => '',
    fetchImpl: async () => assert.fail('no request without a key'),
  });
  assert.equal((await offline.getQuota()).limit, 500000);
});
