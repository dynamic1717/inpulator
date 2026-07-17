/**
 * A translation provider translates text and optionally exposes its quota.
 *
 * @typedef {Object} TranslationProvider
 * @property {string} id
 * @property {(text: string, options: { source: string, target: string }) => Promise<string>} translate
 * @property {() => Promise<{charsUsed: number, dailyLimit: number, remaining: number}>} getQuota
 */

export const DEFAULT_LANGUAGE_PAIR = Object.freeze({
  source: 'ru',
  target: 'en',
});
