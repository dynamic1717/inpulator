/** Shared settings key and defaults for ES-module contexts (background). */

export const SETTINGS_KEY = 'extensionSettings';
export const GOOGLE_API_KEY_STORAGE_KEY = 'googleTranslateApiKey';
export const MYMEMORY_EMAIL_STORAGE_KEY = 'myMemoryEmail';

export const DEFAULT_SETTINGS = {
  enabled: true,
  showCharCounter: true,
  provider: 'mymemory',
  blockedDomains: [],
};

export function generateMyMemoryEmail() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const id = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `inpulator-${id}@example.com`;
}

export async function ensureMyMemoryEmail(storage = chrome.storage.local) {
  const data = await storage.get(MYMEMORY_EMAIL_STORAGE_KEY);
  const existing = String(data[MYMEMORY_EMAIL_STORAGE_KEY] || '').trim();
  if (existing) return existing;

  const email = generateMyMemoryEmail();
  await storage.set({ [MYMEMORY_EMAIL_STORAGE_KEY]: email });
  return email;
}

export function normalizeSettings(raw) {
  const provider =
    raw?.provider === 'chrome' || raw?.provider === 'google'
      ? raw.provider
      : 'mymemory';
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
