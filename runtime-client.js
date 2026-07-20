(function () {
  'use strict';

  if (window.__inputTranslateRuntimeClient) return;

  window.InputTranslate = window.InputTranslate || {};
  const QUOTA_CACHE_TTL = 5000;
  let quotaCache = null;
  let quotaCacheExpiresAt = 0;

  async function sendMessage(message) {
    const response = await chrome.runtime.sendMessage(message);
    const error = chrome.runtime.lastError?.message;
    if (error) throw new Error(error);
    if (response?.error) throw new Error(response.error);
    return response;
  }

  function invalidateQuotaCache() {
    quotaCache = null;
    quotaCacheExpiresAt = 0;
  }

  async function getQuotaRemaining({ force = false } = {}) {
    if (!force && quotaCache && Date.now() < quotaCacheExpiresAt) {
      return quotaCache.remaining;
    }

    const quota = await sendMessage({ type: 'GET_QUOTA' });
    quotaCache = quota;
    quotaCacheExpiresAt = Date.now() + QUOTA_CACHE_TTL;
    return quota?.remaining ?? null;
  }

  async function translate(text) {
    const response = await sendMessage({ type: 'TRANSLATE', text });
    quotaCache = response.quota || null;
    quotaCacheExpiresAt = Date.now() + QUOTA_CACHE_TTL;
    return response;
  }

  window.InputTranslate.runtimeClient = {
    getQuotaRemaining,
    invalidateQuotaCache,
    translate,
  };
  window.__inputTranslateRuntimeClient = true;
})();
