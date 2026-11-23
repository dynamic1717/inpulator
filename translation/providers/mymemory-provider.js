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

const TAG_RE = /<\/?[a-z][^>]*>/i;
const ENTITY_RE = /&(?:#\d+|#x[0-9a-f]+|[a-z]+);/i;
const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function hasMarkup(text) {
  return TAG_RE.test(text) || ENTITY_RE.test(text);
}

function stripMarkup(text) {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(
      /&([a-z]+);/gi,
      (entity, name) => NAMED_ENTITIES[name.toLowerCase()] ?? entity
    );
}

/**
 * MyMemory may answer from its translation memory, whose entries sometimes
 * carry HTML tags or entities. When the source has no markup, prefer the
 * machine translation of this exact query (created-by "MT!") and otherwise
 * strip the markup.
 */
export function pickMyMemoryTranslation(data, sourceText) {
  const primary = data.responseData.translatedText;
  if (hasMarkup(sourceText) || !hasMarkup(primary)) return primary;

  const machine = (data.matches || []).find(
    (match) =>
      match?.['created-by'] === 'MT!' &&
      typeof match.translation === 'string' &&
      match.translation.trim() &&
      !hasMarkup(match.translation)
  );
  return machine ? machine.translation : stripMarkup(primary);
}

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
        throw new Error('Translation request timed out');
      }
      throw new Error('Network error');
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const data = await response.json();
    if (data.quotaFinished || data.responseStatus === 429) {
      throw new Error('Daily translation limit reached');
    }
    if (data.responseStatus !== 200 || !data.responseData?.translatedText) {
      throw new Error(
        data.responseDetails
          ? `MyMemory error: ${data.responseDetails}`
          : 'Translation failed'
      );
    }
    return pickMyMemoryTranslation(data, text);
  }

  return {
    id: 'mymemory',
    isAvailable: async () => true,
    getQuota,
    translate(text, options) {
      return serialize(async () => {
        const { leadingWhitespace, content, trailingWhitespace } = normalizeText(text);
        const quota = await getQuota();
        if (content.length > quota.remaining) {
          throw new Error(
            `Not enough quota: ${content.length} characters selected, ${quota.remaining} remaining`
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
