import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import { getFlagUrl } from '../popup/lib/format.js';
import { LANGUAGES } from '../translation/languages.js';

test('every registry flag path points to an svg asset', async () => {
  globalThis.chrome = {
    runtime: { getURL: (path) => `chrome-extension://id/${path}` },
  };
  try {
    for (const lang of LANGUAGES) {
      assert.match(lang.flag, /^popup\/flags\/[a-z]{2}\.svg$/);
      assert.equal(getFlagUrl(lang), `chrome-extension://id/${lang.flag}`);
      await readFile(new URL(`../${lang.flag}`, import.meta.url), 'utf8');
    }
  } finally {
    delete globalThis.chrome;
  }
});
