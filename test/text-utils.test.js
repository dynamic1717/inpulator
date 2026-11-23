import assert from 'node:assert/strict';
import test from 'node:test';

import { translateByLines } from '../translation/text-utils.js';

test('translateByLines keeps line breaks, blank lines and outer whitespace', async () => {
  const calls = [];
  const result = await translateByLines('  Один\n\nДва  \r\nТри', async (line) => {
    calls.push(line);
    return line.toUpperCase();
  });

  assert.equal(result, '  ОДИН\n\nДВА  \r\nТРИ');
  assert.deepEqual(calls, ['Один', 'Два', 'Три']);
});

test('translateByLines skips whitespace-only input', async () => {
  let called = false;
  const result = await translateByLines(' \n ', async () => {
    called = true;
    return 'x';
  });
  assert.equal(result, ' \n ');
  assert.equal(called, false);
});
