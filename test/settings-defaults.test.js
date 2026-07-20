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
});

test('uses safe default settings for malformed blocked domains', () => {
  const settings = normalizeSettings({ blockedDomains: 'not-an-array' });

  assert.equal(settings.provider, 'chrome');
  assert.deepEqual(settings.blockedDomains, []);
});
