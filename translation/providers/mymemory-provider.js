import { DEFAULT_LANGUAGE_PAIR } from '../provider.js';

const API_URL = 'https://api.mymemory.translated.net/get';
const MAX_CHUNK_SIZE = 450;
const DAILY_CHAR_LIMIT = 50000;
const STORAGE_KEY = 'dailyUsage';
const MYMEMORY_EMAIL = 'pamotod102@meikeya.com';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeText(text) {
  const leadingWhitespace = text.match(/^\s*/)?.[0] || '';
  const trailingWhitespace = text.match(/\s*$/)?.[0] || '';
  const content = text.slice(
    leadingWhitespace.length,
    text.length - trailingWhitespace.length
  );

  if (!content) throw new Error('Empty text');
  return { leadingWhitespace, content, trailingWhitespace };
}

// Separators are kept outside API requests so translated chunks never merge words.
export function splitIntoChunks(text, maxSize = MAX_CHUNK_SIZE) {
  const chunks = [];
  let start = 0;

  while (text.length - start > maxSize) {
    const candidate = text.slice(start, start + maxSize + 1);
    const boundary = candidate.slice(0, maxSize + 1).search(/\s(?=[^\s]*$)/);

    if (boundary <= 0) {
      chunks.push({ text: text.slice(start, start + maxSize), separator: '' });
      start += maxSize;
      continue;
    }

    let separatorEnd = start + boundary;
    while (separatorEnd < text.length && /\s/.test(text[separatorEnd])) {
      separatorEnd += 1;
    }

    chunks.push({
      text: text.slice(start, start + boundary),
      separator: text.slice(start + boundary, separatorEnd),
    });
    start = separatorEnd;
  }

  if (start < text.length) chunks.push({ text: text.slice(start), separator: '' });
  return chunks;
}

export function createMyMemoryProvider({
  storage = chrome.storage.local,
  fetchImpl = fetch,
} = {}) {
  let queue = Promise.resolve();

  function serialize(operation) {
    const result = queue.then(operation, operation);
    queue = result.catch(() => undefined);
    return result;
  }

  async function getUsageRecord() {
    const today = todayKey();
    const data = await storage.get(STORAGE_KEY);
    const record = data[STORAGE_KEY];
    return record?.date === today ? record : { date: today, charsUsed: 0 };
  }

  async function getQuota() {
    const record = await getUsageRecord();
    return {
      charsUsed: record.charsUsed,
      dailyLimit: DAILY_CHAR_LIMIT,
      remaining: Math.max(0, DAILY_CHAR_LIMIT - record.charsUsed),
    };
  }

  async function recordUsage(charCount) {
    const record = await getUsageRecord();
    record.charsUsed += charCount;
    await storage.set({ [STORAGE_KEY]: record });
  }

  async function fetchChunk(text, { source, target }) {
    const url = new URL(API_URL);
    url.searchParams.set('q', text);
    url.searchParams.set('langpair', `${source}|${target}`);
    url.searchParams.set('de', MYMEMORY_EMAIL);

    const response = await fetchImpl(url);
    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const data = await response.json();
    if (data.quotaFinished || data.responseStatus === 429) {
      throw new Error('Daily translation limit exceeded');
    }
    if (data.responseStatus !== 200 || !data.responseData?.translatedText) {
      throw new Error(data.responseDetails || 'Translation failed');
    }
    return data.responseData.translatedText;
  }

  return {
    id: 'mymemory',
    getQuota,
    translate(text, options = DEFAULT_LANGUAGE_PAIR) {
      return serialize(async () => {
        const { leadingWhitespace, content, trailingWhitespace } = normalizeText(text);
        const quota = await getQuota();
        if (content.length > quota.remaining) {
          throw new Error(
            `Not enough quota: ${content.length} chars selected, ${quota.remaining} remaining`
          );
        }

        const chunks = splitIntoChunks(content);
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
