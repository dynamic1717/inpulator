const MYMEMORY_URL = 'https://api.mymemory.translated.net/get';
const MAX_CHUNK_SIZE = 450;
const MYMEMORY_EMAIL = 'pamotod102@meikeya.com';
const DAILY_CHAR_LIMIT = 50000;
const STORAGE_KEY = 'dailyUsage';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_QUOTA') {
    getQuotaStatus()
      .then((quota) => sendResponse(quota))
      .catch(() =>
        sendResponse({
          charsUsed: 0,
          dailyLimit: DAILY_CHAR_LIMIT,
          remaining: DAILY_CHAR_LIMIT,
        })
      );
    return true;
  }

  if (message.type !== 'TRANSLATE') return;

  translateText(message.text)
    .then(async (translatedText) => {
      const quota = await getQuotaStatus();
      sendResponse({ translatedText, quota });
    })
    .catch((error) => sendResponse({ error: error.message || 'Translation failed' }));

  return true;
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'translate-selection') return;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0]?.id;
    if (!tabId) return;
    chrome.tabs.sendMessage(tabId, { type: 'TRANSLATE_HOTKEY' });
  });
});

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function getUsageRecord() {
  const today = todayKey();
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const record = data[STORAGE_KEY];

  if (!record || record.date !== today) {
    return { date: today, charsUsed: 0 };
  }

  return record;
}

async function getQuotaStatus() {
  const record = await getUsageRecord();
  const remaining = Math.max(0, DAILY_CHAR_LIMIT - record.charsUsed);

  return {
    charsUsed: record.charsUsed,
    dailyLimit: DAILY_CHAR_LIMIT,
    remaining,
  };
}

async function recordUsage(charCount) {
  const record = await getUsageRecord();
  record.charsUsed += charCount;
  await chrome.storage.local.set({ [STORAGE_KEY]: record });
}

async function translateText(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Empty text');
  }

  const quota = await getQuotaStatus();
  if (quota.remaining <= 0) {
    throw new Error('Daily translation limit exceeded');
  }
  if (trimmed.length > quota.remaining) {
    throw new Error(
      `Not enough quota: ${trimmed.length} chars selected, ${quota.remaining} remaining`
    );
  }

  let translatedText;
  if (trimmed.length <= MAX_CHUNK_SIZE) {
    translatedText = await fetchChunk(trimmed);
  } else {
    const chunks = splitIntoChunks(trimmed, MAX_CHUNK_SIZE);
    const translated = await Promise.all(chunks.map(fetchChunk));
    translatedText = translated.join('');
  }

  await recordUsage(trimmed.length);
  return translatedText;
}

async function fetchChunk(text) {
  const url = new URL(MYMEMORY_URL);
  url.searchParams.set('q', text);
  url.searchParams.set('langpair', 'ru|en');
  url.searchParams.set('de', MYMEMORY_EMAIL);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();

  if (data.quotaFinished || data.responseStatus === 429) {
    throw new Error('Daily translation limit exceeded');
  }

  if (data.responseStatus !== 200) {
    throw new Error(data.responseDetails || 'Translation failed');
  }

  return data.responseData.translatedText;
}

function splitIntoChunks(text, maxSize) {
  const chunks = [];
  let remaining = text;

  while (remaining.length > maxSize) {
    let splitAt = remaining.lastIndexOf(' ', maxSize);
    if (splitAt <= 0) splitAt = maxSize;
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}
