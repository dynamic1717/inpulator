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

test('splitIntoChunks cuts unspaced text after punctuation, not mid-phrase', async () => {
  const { splitIntoChunks } = await import('../translation/text-utils.js');
  assert.deepEqual(splitIntoChunks('今天天气很好。明天会下雨。', 8), [
    { text: '今天天气很好。', separator: '' },
    { text: '明天会下雨。', separator: '' },
  ]);
  assert.deepEqual(splitIntoChunks('一二三四五六七八九十', 4), [
    { text: '一二三四', separator: '' },
    { text: '五六七八', separator: '' },
    { text: '九十', separator: '' },
  ]);
});
