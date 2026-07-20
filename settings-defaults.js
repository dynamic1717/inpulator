/** Shared settings key and defaults for ES-module contexts (background). */

export const SETTINGS_KEY = 'extensionSettings';

export const DEFAULT_SETTINGS = {
  enabled: true,
  showCharCounter: true,
  provider: 'chrome',
};

export function normalizeSettings(raw) {
  const provider =
    raw?.provider === 'mymemory' || raw?.provider === 'google'
      ? raw.provider
      : 'chrome';

  return {
    enabled: raw?.enabled !== false,
    showCharCounter: raw?.showCharCounter !== false,
    provider,
  };
}
