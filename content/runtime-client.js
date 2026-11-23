/** Messaging with the background service worker. */

const QUOTA_CACHE_TTL_MS = 5000;
let quotaCache = null;
let quotaCacheExpiresAt = 0;

async function sendMessage(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (response?.error) throw new Error(response.error);
  return response;
}

function cacheQuota(quota) {
  quotaCache = quota || null;
  quotaCacheExpiresAt = Date.now() + QUOTA_CACHE_TTL_MS;
}

export function invalidateQuotaCache() {
  quotaCache = null;
  quotaCacheExpiresAt = 0;
}

export async function getQuota() {
  if (quotaCache && Date.now() < quotaCacheExpiresAt) return quotaCache;
  const quota = await sendMessage({ type: 'GET_QUOTA' });
  cacheQuota(quota);
  return quota;
}

export async function translate(text, { sourceLanguage }) {
  const response = await sendMessage({ type: 'TRANSLATE', text, sourceLanguage });
  cacheQuota(response.quota);
  return response;
}

export function getTranslateShortcut() {
  return sendMessage({ type: 'GET_TRANSLATE_SHORTCUT' });
}
