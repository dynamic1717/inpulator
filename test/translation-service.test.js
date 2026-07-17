import assert from 'node:assert/strict';
import test from 'node:test';

import { createTranslationService } from '../translation/translation-service.js';

test('service selects the first available provider', async () => {
  const unavailable = {
    id: 'failed-check',
    isAvailable: async () => {
      throw new Error('API unavailable');
    },
    translate: async () => 'unused',
  };
  const available = {
    id: 'available',
    isAvailable: async () => true,
    translate: async () => 'translated',
    getQuota: async () => ({ charsUsed: 1, dailyLimit: 10, remaining: 9 }),
  };
  const service = createTranslationService({ providers: [unavailable, available] });

  assert.deepEqual(await service.translate('тест'), {
    translatedText: 'translated',
    provider: 'available',
    quota: { charsUsed: 1, dailyLimit: 10, remaining: 9 },
  });
});
