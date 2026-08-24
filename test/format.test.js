import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { getFlagUrl } from '../popup/lib/format.js';
import { LANGUAGES } from '../translation/languages.js';

test('every registry flag path points to an svg asset', async () => {
  for (const lang of LANGUAGES) {
    assert.match(lang.flag, /^popup\/flags\/[a-z]{2}\.svg$/);
    const url = getFlagUrl(lang);
    assert.ok(url, `${lang.id} should resolve a flag url`);
    await readFile(fileURLToPath(url), 'utf8');
  }
});
