import { DEFAULT_LANGUAGE_PAIR } from '../provider.js';
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
      dailyLimit: MONTHLY_CHAR_LIMIT,
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

  async function fetchChunk(text, { source, target }) {
    const url = new URL(API_URL);
    url.searchParams.set('key', apiKey);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    let response;

    try {
      response = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        throw new Error('Translation request timed out');
      }
      throw new Error('Network error');
    } finally {
      clearTimeout(timeoutId);
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        data?.error?.message || `Google Translate API error: ${response.status}`;
      throw new Error(message);
    }

    const translated = data?.data?.translations?.[0]?.translatedText;
    if (!translated) throw new Error('Translation failed');
    return translated;
  }

  return {
    id: 'google',
    isAvailable: async () => Boolean(apiKey),
    getQuota,
    translate(text, options = DEFAULT_LANGUAGE_PAIR) {
      return serialize(async () => {
        if (!apiKey) {
          throw new Error(
            'Google API key missing. Add GOOGLE_TRANSLATE_API_KEY to .env and run npm run env'
          );
        }

        const { leadingWhitespace, content, trailingWhitespace } = normalizeText(text);
        const quota = await getQuota();
        if (content.length > quota.remaining) {
          throw new Error(
            `Not enough quota: ${content.length} chars selected, ${quota.remaining} remaining`
          );
        }

        const chunks = splitIntoChunks(content, MAX_CHUNK_SIZE);
        let translatedText = '';
        for (const chunk of chunks) {
          translatedText += `${await fetchChunk(chunk.text, options)}${chunk.separator}`;
        }

        await recordUsage(content.length);
        return `${leadingWhitespace}${translatedText}${trailingWhitespace}`;
      });
    },
  };
}
