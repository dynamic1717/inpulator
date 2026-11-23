/** Offscreen document host for the on-device Chrome Translator API. */

import { translateByLines } from '../translation/text-utils.js';

/** @typedef {{ availability: string|null, downloading: boolean, progress: number, error: string|null }} ModelStatus */

const translators = new Map();
/** @type {Map<string, ModelStatus>} status per language pair */
const statuses = new Map();
/** Pairs whose Translator.create() is in flight; polls must not reset their progress. */
const installing = new Set();

function pairKey(source, target) {
  return `${source}|${target}`;
}

function pairLabel(source, target) {
  return `${String(source).toUpperCase()}→${String(target).toUpperCase()}`;
}

function packUnavailableMessage(source, target) {
  return `Could not download the Chrome language pack for ${pairLabel(source, target)}. Download is unavailable for this pair.`;
}

function packNotDownloadedMessage(source, target) {
  return `The ${pairLabel(source, target)} language pack is not ready on this site yet. Click the translate button once (the shortcut can't start a download) or use "Download packs" in the extension popup.`;
}

function assertTranslatorApi() {
  if (!('Translator' in globalThis)) {
    throw new Error(
      'Chrome Translator API is unavailable. Requires Chrome 138+ (desktop).'
    );
  }
}

function getStatus(source, target) {
  const key = pairKey(source, target);
  if (!statuses.has(key)) {
    statuses.set(key, {
      availability: null,
      downloading: false,
      progress: 0,
      error: null,
    });
  }
  return statuses.get(key);
}

function updateStatus(source, target, patch) {
  const status = Object.assign(getStatus(source, target), patch);
  chrome.runtime
    .sendMessage({
      type: 'CHROME_MODEL_STATUS',
      sourceLanguage: source,
      targetLanguage: target,
      status: { ...status },
    })
    .catch(() => undefined);
  return { ...status };
}

async function refreshAvailability(source, target) {
  try {
    assertTranslatorApi();
    const availability = await globalThis.Translator.availability({
      sourceLanguage: source,
      targetLanguage: target,
    });
    if (installing.has(pairKey(source, target))) {
      return updateStatus(source, target, { availability, error: null });
    }
    return updateStatus(source, target, {
      availability,
      error: null,
      downloading: availability === 'downloading',
      progress: availability === 'available' ? 1 : getStatus(source, target).progress,
    });
  } catch (error) {
    return updateStatus(source, target, {
      availability: 'unsupported',
      downloading: false,
      progress: 0,
      error: error.message || 'Could not check availability',
    });
  }
}

async function getTranslator(source, target) {
  assertTranslatorApi();
  const key = pairKey(source, target);
  if (translators.has(key)) return translators.get(key);

  const availability = await globalThis.Translator.availability({
    sourceLanguage: source,
    targetLanguage: target,
  });
  if (availability === 'unavailable') {
    updateStatus(source, target, {
      availability,
      error: packUnavailableMessage(source, target),
    });
    throw new Error(packUnavailableMessage(source, target));
  }

  const needsDownload =
    availability === 'downloadable' || availability === 'downloading';
  installing.add(key);
  updateStatus(source, target, {
    availability,
    downloading: needsDownload,
    progress: needsDownload ? 0 : getStatus(source, target).progress,
  });

  try {
    const translator = await globalThis.Translator.create({
      sourceLanguage: source,
      targetLanguage: target,
      monitor(monitor) {
        monitor.addEventListener('downloadprogress', (event) => {
          updateStatus(source, target, {
            downloading: true,
            progress: Math.min(1, Math.max(0, Number(event.loaded) || 0)),
          });
        });
      },
    });
    translators.set(key, translator);
    updateStatus(source, target, {
      availability: 'available',
      downloading: false,
      progress: 1,
      error: null,
    });
    return translator;
  } catch (error) {
    const latest = await globalThis.Translator.availability({
      sourceLanguage: source,
      targetLanguage: target,
    }).catch(() => availability);

    // Only "unavailable" means the pair can't be installed. Any other create()
    // failure while a download is needed is the missing user gesture: this
    // offscreen document never has one (Chrome may report it as a generic
    // failure rather than NotAllowedError).
    let message;
    if (latest === 'unavailable') {
      message = packUnavailableMessage(source, target);
    } else if (needsDownload || latest === 'downloadable' || latest === 'downloading') {
      message = packNotDownloadedMessage(source, target);
    } else {
      message = error?.message || 'Chrome translation failed';
    }

    updateStatus(source, target, {
      availability: latest,
      downloading: false,
      error: message,
    });
    throw new Error(message);
  } finally {
    installing.delete(key);
  }
}

async function ensureModel(source, target) {
  const status = await refreshAvailability(source, target);
  if (status.availability === 'unavailable' || status.availability === 'unsupported') {
    return status.error
      ? status
      : updateStatus(source, target, { error: packUnavailableMessage(source, target) });
  }
  await getTranslator(source, target);
  return { ...getStatus(source, target) };
}

async function translateWith(translator, text) {
  return translateByLines(text, (line) => translator.translate(line));
}

async function translateText(text, source, target) {
  const translator = await getTranslator(source, target);
  try {
    return await translateWith(translator, text);
  } catch {
    // A cached instance can die (e.g. the model was unloaded) and then fails
    // with "Other generic failures occurred". Retry once with a fresh one.
    translators.delete(pairKey(source, target));
    translator.destroy?.();
    return translateWith(await getTranslator(source, target), text);
  }
}

const HANDLERS = {
  OFFSCREEN_AVAILABILITY: ({ sourceLanguage, targetLanguage }) =>
    refreshAvailability(sourceLanguage, targetLanguage).then(({ availability }) => ({
      availability,
    })),
  OFFSCREEN_MODEL_STATUS: ({ sourceLanguage, targetLanguage }) =>
    refreshAvailability(sourceLanguage, targetLanguage).then((status) => ({ status })),
  OFFSCREEN_ENSURE_MODEL: ({ sourceLanguage, targetLanguage }) =>
    ensureModel(sourceLanguage, targetLanguage).then((status) => ({ status })),
  OFFSCREEN_TRANSLATE: ({ text, sourceLanguage, targetLanguage }) =>
    translateText(text, sourceLanguage, targetLanguage).then((translatedText) => ({
      translatedText,
    })),
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== 'offscreen') return;
  const handler = HANDLERS[message.type];
  if (!handler) return;
  handler(message)
    .then(sendResponse)
    .catch((error) =>
      sendResponse({ error: error.message || 'Chrome translation failed' })
    );
  return true;
});
