import { t } from '../../i18n.js';
import { normalizeText, splitIntoChunks } from '../text-utils.js';

const API_URL = 'https://translation.googleapis.com/language/translate/v2';
const MAX_CHUNK_SIZE = 4000;
const MONTHLY_CHAR_LIMIT = 500000;
const STORAGE_KEY = 'googleMonthlyUsage';
const REQUEST_TIMEOUT_MS = 15000;

function monthKey() {
  return new Date().toISOString().slice(0, 7);
}

export function createGoogleProvider({
  storage,
  fetchImpl = fetch,
  timeoutMs = REQUEST_TIMEOUT_MS,
  apiKey = '',
  getApiKey = async () => apiKey,
} = {}) {
  const store = storage ?? chrome.storage.local;
  let queue = Promise.resolve();

  function serialize(operation) {
    const result = queue.then(operation, operation);
    queue = result.catch(() => undefined);
    return result;
  }

  async function getUsageRecord() {
    const month = monthKey();
    const data = await store.get(STORAGE_KEY);
    const record = data[STORAGE_KEY];
    return record?.month === month ? record : { month, charsUsed: 0 };
  }

  async function getQuota() {
    const record = await getUsageRecord();
    return {
      charsUsed: record.charsUsed,
      limit: MONTHLY_CHAR_LIMIT,
      remaining: Math.max(0, MONTHLY_CHAR_LIMIT - record.charsUsed),
      period: 'month',
      provider: 'google',
    };
  }

  async function recordUsage(charCount) {
    const record = await getUsageRecord();
    record.charsUsed += charCount;
    await store.set({ [STORAGE_KEY]: record });
  }

  async function fetchChunk(text, { source, target }, currentApiKey) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    let response;

    try {
      // Header instead of ?key= keeps the key out of URLs and request logs.
      response = await fetchImpl(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': currentApiKey,
        },
        body: JSON.stringify({
          q: text,
          source,
          target,
          format: 'text',
        }),
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) {
        throw new Error(t('errorTimeout'));
      }
      throw new Error(t('errorNetwork'));
    } finally {
      clearTimeout(timeoutId);
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        data?.error?.message
          ? t('errorGoogle', data.error.message)
          : t('errorApiStatus', response.status)
      );
    }

    const translated = data?.data?.translations?.[0]?.translatedText;
    if (!translated) throw new Error(t('errorTranslationFailed'));
    return translated;
  }

  return {
    id: 'google',
    isAvailable: async () => Boolean(await getApiKey()),
    getQuota,
    translate(text, options) {
      return serialize(async () => {
        const currentApiKey = await getApiKey();
        if (!currentApiKey) {
          throw new Error(t('errorGoogleKeyMissing'));
        }

        const { leadingWhitespace, content, trailingWhitespace } = normalizeText(text);
        const quota = await getQuota();
        if (content.length > quota.remaining) {
          throw new Error(t('errorNotEnoughQuota', content.length, quota.remaining));
        }

        const chunks = splitIntoChunks(content, MAX_CHUNK_SIZE);
        let translatedText = '';
        for (const chunk of chunks) {
          translatedText += `${await fetchChunk(chunk.text, options, currentApiKey)}${chunk.separator}`;
        }

        await recordUsage(content.length);
        return `${leadingWhitespace}${translatedText}${trailingWhitespace}`;
      });
    },
  };
}
