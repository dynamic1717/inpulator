import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeSettings } from '../settings-defaults.js';

test('normalizes blocked domains and removes duplicates', () => {
  const settings = normalizeSettings({
    provider: 'google',
    blockedDomains: [
      'https://Bank.Example/login',
      '*.bank.example',
      'bank.example',
      '',
    ],
  });

  assert.equal(settings.provider, 'google');
  assert.deepEqual(settings.blockedDomains, ['bank.example']);
  assert.equal(settings.targetLanguage, 'en');
  assert.deepEqual(settings.disabledSourceLanguages, []);
});

test('uses safe default settings for malformed blocked domains', () => {
  const settings = normalizeSettings({ blockedDomains: 'not-an-array' });

  assert.equal(settings.provider, 'mymemory');
  assert.deepEqual(settings.blockedDomains, []);
});

test('normalizes targetLanguage and disabledSourceLanguages', () => {
  const settings = normalizeSettings({
    targetLanguage: 'fr',
    disabledSourceLanguages: ['ru', 'ru', 'th', 'zh-CN'],
  });

  assert.equal(settings.targetLanguage, 'fr');
  assert.deepEqual(settings.disabledSourceLanguages, ['ru', 'zh']);
});

test('falls back to english for unknown targetLanguage', () => {
  const settings = normalizeSettings({ targetLanguage: 'th' });
  assert.equal(settings.targetLanguage, 'en');
});
