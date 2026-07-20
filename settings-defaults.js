/** Shared settings key and defaults for ES-module contexts (background). */

export const SETTINGS_KEY = 'extensionSettings';
export const GOOGLE_API_KEY_STORAGE_KEY = 'googleTranslateApiKey';

export const DEFAULT_SETTINGS = {
  enabled: true,
  showCharCounter: true,
  provider: 'chrome',
  blockedDomains: [],
};

export function normalizeSettings(raw) {
  const provider =
    raw?.provider === 'mymemory' || raw?.provider === 'google'
      ? raw.provider
      : 'chrome';
  const blockedDomains = Array.isArray(raw?.blockedDomains)
    ? [...new Set(raw.blockedDomains.map(normalizeDomain).filter(Boolean))]
    : [];

  return {
    enabled: raw?.enabled !== false,
    showCharCounter: raw?.showCharCounter !== false,
    provider,
    blockedDomains,
  };
}

export function normalizeDomain(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^\*\./, '')
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^\.+|\.+$/g, '');
}
