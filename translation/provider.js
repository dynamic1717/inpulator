/**
 * A translation provider translates text and may expose a local quota.
 *
 * @typedef {Object} TranslationProvider
 * @property {string} id
 * @property {() => Promise<boolean>} isAvailable
 * @property {(text: string, options: { source: string, target: string }) => Promise<string>} translate
 * @property {() => Promise<{charsUsed: number, limit: number, remaining: number, period: 'day'|'month', provider: string, dailyLimit?: number}>} [getQuota]
 */

export const DEFAULT_LANGUAGE_PAIR = Object.freeze({
  source: 'ru',
  target: 'en',
});
