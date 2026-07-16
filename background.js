const MYMEMORY_URL = 'https://api.mymemory.translated.net/get';
const MAX_CHUNK_SIZE = 450;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'TRANSLATE') return;

  translateText(message.text)
    .then((translatedText) => sendResponse({ translatedText }))
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

async function translateText(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Empty text');
  }

  if (trimmed.length <= MAX_CHUNK_SIZE) {
    return fetchChunk(trimmed);
  }

  const chunks = splitIntoChunks(trimmed, MAX_CHUNK_SIZE);
  const translated = await Promise.all(chunks.map(fetchChunk));
  return translated.join('');
}

async function fetchChunk(text) {
  const url = new URL(MYMEMORY_URL);
  url.searchParams.set('q', text);
  url.searchParams.set('langpair', 'ru|en');

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
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
