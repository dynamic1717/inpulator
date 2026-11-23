import { t } from '../../i18n.js';
import { normalizeText, splitIntoChunks } from '../text-utils.js';

const FREE_API = 'https://api-free.deepl.com';
const PRO_API = 'https://api.deepl.com';
/** DeepL caps a whole request at 128 KiB; stay well under it per chunk. */
const MAX_CHUNK_SIZE = 20000;
/** DeepL API Free monthly allowance; used only when /v2/usage can't be read. */
const FREE_MONTHLY_CHAR_LIMIT = 500000;
const USAGE_STORAGE_KEY = 'deeplMonthlyUsage';
const USAGE_CACHE_MS = 60_000;
const REQUEST_TIMEOUT_MS = 15000;

/**
 * Target codes DeepL wants with a variant (bare EN/PT are deprecated as
 * targets). Sources always use the bare code.
 */
const TARGET_VARIANTS = { EN: 'EN-US', PT: 'PT-BR', ZH: 'ZH-HANS' };

export function getDeepLHosts() {
  return [`${FREE_API}/*`, `${PRO_API}/*`];
}

/** Free-plan keys end with ":fx" and must use the api-free host. */
export function getDeepLBaseUrl(apiKey) {
  return String(apiKey).trim().endsWith(':fx') ? FREE_API : PRO_API;
}

export function toDeepLCodes({ source, target }) {
  const sourceCode = String(source).split('-')[0].toUpperCase();
  const targetBase = String(target).split('-')[0].toUpperCase();
  return { source: sourceCode, target: TARGET_VARIANTS[targetBase] || targetBase };
}

function monthKey() {
  return new Date().toISOString().slice(0, 7);
}

function errorForStatus(status, data) {
  if (status === 403) return t('errorDeepLKeyInvalid');
  if (status === 456) return t('errorDeepLQuota');
  if (status === 429) return t('errorDeepLTooManyRequests');
  if (data?.message) return t('errorDeepL', data.message);
  return t('errorApiStatus', status);
}

export function createDeepLProvider({
  storage,
  fetchImpl = fetch,
  timeoutMs = REQUEST_TIMEOUT_MS,
  getApiKey = async () => '',
  hasHostPermission = defaultHasHostPermission,
} = {}) {
  const store = storage ?? chrome.storage.local;
  let usageCache = null;
  let usageCacheExpiresAt = 0;

  async function request(path, apiKey, init = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(`${getDeepLBaseUrl(apiKey)}${path}`, {
        ...init,
        headers: { Authorization: `DeepL-Auth-Key ${apiKey}`, ...init.headers },
        signal: controller.signal,
      });
    } catch {
      throw new Error(
        controller.signal.aborted ? t('errorTimeout') : t('errorNetwork')
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function getLocalUsage() {
    const record = (await store.get(USAGE_STORAGE_KEY))[USAGE_STORAGE_KEY];
    return record?.month === monthKey() ? record : { month: monthKey(), charsUsed: 0 };
  }

  async function recordLocalUsage(charCount) {
    const record = await getLocalUsage();
    record.charsUsed += charCount;
    await store.set({ [USAGE_STORAGE_KEY]: record });
  }

  function toQuota(charsUsed, limit) {
    return {
      charsUsed,
      limit,
      remaining: Math.max(0, limit - charsUsed),
      period: 'month',
      provider: 'deepl',
    };
  }

  /** Real account usage from DeepL (shared with other apps using the key). */
  async function getQuota() {
    if (usageCache && Date.now() < usageCacheExpiresAt) return usageCache;
    const apiKey = String((await getApiKey()) || '').trim();
    if (apiKey && (await hasHostPermission())) {
      try {
        const response = await request('/v2/usage', apiKey);
        if (response.ok) {
          const data = await response.json();
          if (Number.isFinite(data?.character_limit) && data.character_limit > 0) {
            usageCache = toQuota(data.character_count || 0, data.character_limit);
            usageCacheExpiresAt = Date.now() + USAGE_CACHE_MS;
            return usageCache;
          }
        }
      } catch {
        // Fall back to the local estimate.
      }
    }
    return toQuota((await getLocalUsage()).charsUsed, FREE_MONTHLY_CHAR_LIMIT);
  }

  async function translateChunk(text, codes, apiKey) {
    const response = await request('/v2/translate', apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: [text],
        source_lang: codes.source,
        target_lang: codes.target,
        preserve_formatting: true,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(errorForStatus(response.status, data));

    const translated = data?.translations?.[0]?.text;
    if (typeof translated !== 'string') throw new Error(t('errorTranslationFailed'));
    return translated;
  }

  return {
    id: 'deepl',
    // Missing key or permission are reported by translate() with a precise message.
    isAvailable: async () => true,
    getQuota,
    async translate(text, pair) {
      const apiKey = String((await getApiKey()) || '').trim();
      if (!apiKey) throw new Error(t('errorDeepLKeyMissing'));
      if (!(await hasHostPermission())) throw new Error(t('errorDeepLPermission'));

      const { leadingWhitespace, content, trailingWhitespace } = normalizeText(text);
      const codes = toDeepLCodes(pair);
      let translatedText = '';
      for (const chunk of splitIntoChunks(content, MAX_CHUNK_SIZE)) {
        translatedText += `${await translateChunk(chunk.text, codes, apiKey)}${chunk.separator}`;
      }

      await recordLocalUsage(content.length);
      usageCache = null;
      return `${leadingWhitespace}${translatedText}${trailingWhitespace}`;
    },
  };
}

async function defaultHasHostPermission() {
  if (typeof chrome === 'undefined' || !chrome.permissions?.contains) return true;
  return chrome.permissions.contains({ origins: getDeepLHosts() });
}
