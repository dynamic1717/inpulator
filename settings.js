/** Settings schema and chrome.storage helpers shared by every context. */

import {
  getShippedLanguageIds,
  isShippedLanguageId,
  normalizeLanguageId,
} from './translation/languages.js';

export const SETTINGS_KEY = 'extensionSettings';
export const GOOGLE_API_KEY_STORAGE_KEY = 'googleTranslateApiKey';
export const MYMEMORY_EMAIL_STORAGE_KEY = 'myMemoryEmail';

export const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  provider: 'mymemory',
  blockedDomains: [],
  targetLanguage: 'en',
  disabledSourceLanguages: [],
});

const PROVIDERS = new Set(['mymemory', 'chrome', 'google']);

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

export function normalizeDomain(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^\*\./, '')
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^\.+|\.+$/g, '');
}

export function isHostBlocked(host, blockedDomains = []) {
  const normalized = String(host || '').toLowerCase();
  return blockedDomains.some(
    (domain) => normalized === domain || normalized.endsWith(`.${domain}`)
  );
}

function normalizeDisabledSourceLanguages(raw) {
  if (!Array.isArray(raw)) return [];
  const shipped = new Set(getShippedLanguageIds());
  return [
    ...new Set(
      raw.map((id) => normalizeLanguageId(id)).filter((id) => id && shipped.has(id))
    ),
  ];
}

export function normalizeSettings(raw) {
  return {
    enabled: raw?.enabled !== false,
    provider: PROVIDERS.has(raw?.provider) ? raw.provider : DEFAULT_SETTINGS.provider,
    blockedDomains: Array.isArray(raw?.blockedDomains)
      ? [...new Set(raw.blockedDomains.map(normalizeDomain).filter(Boolean))]
      : [],
    targetLanguage: isShippedLanguageId(raw?.targetLanguage)
      ? raw.targetLanguage
      : DEFAULT_SETTINGS.targetLanguage,
    disabledSourceLanguages: normalizeDisabledSourceLanguages(
      raw?.disabledSourceLanguages
    ),
  };
}

export async function getSettings(storage = chrome.storage.local) {
  const data = await storage.get(SETTINGS_KEY);
  return normalizeSettings(data[SETTINGS_KEY]);
}

export async function setSettings(patch, storage = chrome.storage.local) {
  const current = await getSettings(storage);
  const next = normalizeSettings({ ...current, ...patch });
  await storage.set({ [SETTINGS_KEY]: next });
  return next;
}

/** Calls onChange with normalized settings on every change; returns unsubscribe. */
export function subscribeToSettings(onChange) {
  function listener(changes, areaName) {
    if (areaName !== 'local' || !changes[SETTINGS_KEY]) return;
    onChange(normalizeSettings(changes[SETTINGS_KEY].newValue));
  }

  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

export async function getGoogleApiKey(storage = chrome.storage.local) {
  const data = await storage.get(GOOGLE_API_KEY_STORAGE_KEY);
  return String(data[GOOGLE_API_KEY_STORAGE_KEY] || '').trim();
}

export async function setGoogleApiKey(value, storage = chrome.storage.local) {
  const apiKey = String(value || '').trim();
  if (apiKey) {
    await storage.set({ [GOOGLE_API_KEY_STORAGE_KEY]: apiKey });
  } else {
    await storage.remove(GOOGLE_API_KEY_STORAGE_KEY);
  }
  return apiKey;
}
