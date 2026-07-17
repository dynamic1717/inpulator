import { getQuota, translate } from './translation/translation-service.js';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_QUOTA') {
    getQuota()
      .then(sendResponse)
      .catch(() => sendResponse({ charsUsed: 0, dailyLimit: 50000, remaining: 50000 }));
    return true;
  }

  if (message.type !== 'TRANSLATE') return;

  translate(message.text)
    .then(sendResponse)
    .catch((error) => sendResponse({ error: error.message || 'Translation failed' }));
  return true;
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'translate-selection') return;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0]?.id;
    if (tabId) chrome.tabs.sendMessage(tabId, { type: 'TRANSLATE_HOTKEY' });
  });
});
