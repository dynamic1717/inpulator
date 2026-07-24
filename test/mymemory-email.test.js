import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MYMEMORY_EMAIL_STORAGE_KEY,
  ensureMyMemoryEmail,
  generateMyMemoryEmail,
} from '../settings-defaults.js';

test('generateMyMemoryEmail returns a stable-looking unique address', () => {
  const first = generateMyMemoryEmail();
  const second = generateMyMemoryEmail();

  assert.match(first, /^inpulator-[0-9a-f]{16}@example\.com$/);
  assert.match(second, /^inpulator-[0-9a-f]{16}@example\.com$/);
  assert.notEqual(first, second);
});

test('ensureMyMemoryEmail creates and reuses a stored email', async () => {
  const store = new Map();
  const storage = {
    get: async (key) => ({ [key]: store.get(key) }),
    set: async (value) => {
      for (const [key, next] of Object.entries(value)) store.set(key, next);
    },
  };

  const created = await ensureMyMemoryEmail(storage);
  const reused = await ensureMyMemoryEmail(storage);

  assert.match(created, /^inpulator-[0-9a-f]{16}@example\.com$/);
  assert.equal(reused, created);
  assert.equal(store.get(MYMEMORY_EMAIL_STORAGE_KEY), created);
});
