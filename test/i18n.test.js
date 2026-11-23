import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import { t } from '../i18n.js';

test('t falls back to the English catalog and fills substitutions', () => {
  assert.equal(t('buttonTranslateTo', 'English'), 'Translate to English');
  assert.equal(
    t('errorNotEnoughQuota', 12, 3),
    'Not enough quota: 12 characters selected, 3 remaining'
  );
});

test('every English message has a Russian translation with the same placeholders', async () => {
  const en = JSON.parse(
    await readFile(new URL('../_locales/en/messages.json', import.meta.url))
  );
  const ru = JSON.parse(
    await readFile(new URL('../_locales/ru/messages.json', import.meta.url))
  );
  assert.deepEqual(Object.keys(ru).sort(), Object.keys(en).sort());
  for (const key of Object.keys(en)) {
    const placeholders = (text) => (text.match(/\$\d/g) || []).sort().join();
    assert.equal(placeholders(ru[key].message), placeholders(en[key].message), key);
  }
});
