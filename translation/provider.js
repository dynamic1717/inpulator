/**
 * A translation provider translates text and may expose a local quota.
 * Language codes passed to it are already mapped to the provider's codes.
 *
 * @typedef {Object} TranslationProvider
 * @property {string} id
 * @property {(pair: { source: string, target: string }) => Promise<boolean>} isAvailable
 * @property {(text: string, pair: { source: string, target: string }) => Promise<string>} translate
 * @property {() => Promise<{charsUsed: number, limit: number|null, remaining: number|null, period: 'day'|'month'|'none', provider: string}>} [getQuota]
 */
