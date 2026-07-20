const OFFSCREEN_PATH = 'offscreen/offscreen.html';
const OFFSCREEN_URL = () => chrome.runtime.getURL(OFFSCREEN_PATH);

let creating = null;

export async function ensureOffscreenDocument() {
  const offscreenUrl = OFFSCREEN_URL();
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl],
  });

  if (existingContexts.length > 0) return;

  if (creating) {
    await creating;
    return;
  }

  creating = chrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: ['DOM_SCRAPING'],
    justification: 'Run on-device Chrome Translator API for RU→EN translation',
  });

  try {
    await creating;
  } finally {
    creating = null;
  }
}

export async function sendToOffscreen(message) {
  await ensureOffscreenDocument();
  const response = await chrome.runtime.sendMessage({
    ...message,
    target: 'offscreen',
  });
  if (response?.error) throw new Error(response.error);
  return response;
}
