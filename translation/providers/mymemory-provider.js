import { DEFAULT_LANGUAGE_PAIR } from '../provider.js';
import { normalizeText, splitIntoChunks } from '../text-utils.js';

const API_URL = 'https://api.mymemory.translated.net/get';
const MAX_CHUNK_SIZE = 450;
const DAILY_CHAR_LIMIT = 50000;
const STORAGE_KEY = 'dailyUsage';
const REQUEST_TIMEOUT_MS = 15000;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export { splitIntoChunks } from '../text-utils.js';

export function createMyMemoryProvider({
  storage,
  fetchImpl = fetch,
  timeoutMs = REQUEST_TIMEOUT_MS,
  email = '',
  getEmail = async () => email,
} = {}) {
  const store = storage ?? chrome.storage.local;
  let queue = Promise.resolve();

  function serialize(operation) {
    const result = queue.then(operation, operation);
    queue = result.catch(() => undefined);
    return result;
  }

  async function getUsageRecord() {
    const today = todayKey();
    const data = await store.get(STORAGE_KEY);
    const record = data[STORAGE_KEY];
    return record?.date === today ? record : { date: today, charsUsed: 0 };
  }

  async function getQuota() {
    const record = await getUsageRecord();
    return {
      charsUsed: record.charsUsed,
      limit: DAILY_CHAR_LIMIT,
      dailyLimit: DAILY_CHAR_LIMIT,
      remaining: Math.max(0, DAILY_CHAR_LIMIT - record.charsUsed),
      period: 'day',
      provider: 'mymemory',
    };
  }

  async function recordUsage(charCount) {
    const record = await getUsageRecord();
    record.charsUsed += charCount;
    await store.set({ [STORAGE_KEY]: record });
  }

  async function fetchChunk(text, { source, target }, currentEmail) {
    const url = new URL(API_URL);
    url.searchParams.set('q', text);
    url.searchParams.set('langpair', `${source}|${target}`);
    if (currentEmail) url.searchParams.set('de', currentEmail);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    let response;

    try {
      response = await fetchImpl(url, { signal: controller.signal });
    } catch {
      if (controller.signal.aborted) {
        throw new Error('Превышено время ожидания перевода');
      }
      throw new Error('Ошибка сети');
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) throw new Error(`Ошибка API: ${response.status}`);

    const data = await response.json();
    if (data.quotaFinished || data.responseStatus === 429) {
      throw new Error('Дневной лимит перевода исчерпан');
    }
    if (data.responseStatus !== 200 || !data.responseData?.translatedText) {
      throw new Error(
        data.responseDetails
          ? `Ошибка MyMemory: ${data.responseDetails}`
          : 'Перевод не удался'
      );
    }
    return data.responseData.translatedText;
  }

  return {
    id: 'mymemory',
    isAvailable: async () => true,
    getQuota,
    translate(text, options = DEFAULT_LANGUAGE_PAIR) {
      return serialize(async () => {
        const { leadingWhitespace, content, trailingWhitespace } = normalizeText(text);
        const quota = await getQuota();
        if (content.length > quota.remaining) {
          throw new Error(
            `Недостаточно лимита: ${content.length} символов выбрано, ${quota.remaining} осталось`
          );
        }

        const currentEmail = String((await getEmail()) || '').trim();
        const chunks = splitIntoChunks(content, MAX_CHUNK_SIZE);
        let translatedText = '';
        for (const chunk of chunks) {
          translatedText += `${await fetchChunk(chunk.text, options, currentEmail)}${chunk.separator}`;
        }

        await recordUsage(content.length);
        return `${leadingWhitespace}${translatedText}${trailingWhitespace}`;
      });
    },
  };
}
