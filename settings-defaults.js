/** Shared settings key and defaults for ES-module contexts (background). */

export const SETTINGS_KEY = 'extensionSettings';

export const DEFAULT_SETTINGS = {
  enabled: true,
  showCharCounter: true,
  provider: 'google',
};

export function normalizeSettings(raw) {
  return {
    enabled: raw?.enabled !== false,
    showCharCounter: raw?.showCharCounter !== false,
    provider: raw?.provider === 'mymemory' ? 'mymemory' : 'google',
  };
}
