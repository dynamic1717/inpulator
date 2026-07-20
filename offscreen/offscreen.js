/** Offscreen document host for Chrome Translator API (on-device). */

const translators = new Map();

/** @type {{ availability: string|null, downloading: boolean, progress: number, error: string|null }} */
let modelStatus = {
  availability: null,
  downloading: false,
  progress: 0,
  error: null,
};

function pairKey(source, target) {
  return `${source}|${target}`;
}

function assertTranslatorApi() {
  if (!('Translator' in globalThis)) {
    throw new Error('Chrome Translator API недоступен. Нужен Chrome 138+ (desktop).');
  }
}

function snapshotStatus() {
  return {
    availability: modelStatus.availability,
    downloading: modelStatus.downloading,
    progress: modelStatus.progress,
    error: modelStatus.error,
  };
}

function broadcastStatus() {
  chrome.runtime
    .sendMessage({ type: 'CHROME_MODEL_STATUS', status: snapshotStatus() })
    .catch(() => undefined);
}

async function refreshAvailability(sourceLanguage, targetLanguage) {
  try {
    assertTranslatorApi();
    const availability = await globalThis.Translator.availability({
      sourceLanguage,
      targetLanguage,
    });
    modelStatus.availability = availability;
    modelStatus.error = null;
    if (availability === 'available' && !modelStatus.downloading) {
      modelStatus.progress = 1;
    }
    if (availability === 'downloadable' && !modelStatus.downloading) {
      modelStatus.progress = 0;
    }
  } catch (error) {
    modelStatus = {
      availability: 'unsupported',
      downloading: false,
      progress: 0,
      error: error.message || 'Не удалось проверить доступность',
    };
  }
  broadcastStatus();
  return snapshotStatus();
}

async function getTranslator(sourceLanguage, targetLanguage) {
  assertTranslatorApi();
  const key = pairKey(sourceLanguage, targetLanguage);
  if (translators.has(key)) return translators.get(key);

  const availability = await globalThis.Translator.availability({
    sourceLanguage,
    targetLanguage,
  });
  if (availability === 'unavailable') {
    throw new Error(
      `Chrome Translator: пара ${sourceLanguage}→${targetLanguage} недоступна`
    );
  }

  modelStatus.availability = availability;
  if (availability === 'downloadable') {
    modelStatus.downloading = true;
    modelStatus.progress = 0;
    broadcastStatus();
  }

  try {
    const translator = await globalThis.Translator.create({
      sourceLanguage,
      targetLanguage,
      monitor(m) {
        m.addEventListener('downloadprogress', (event) => {
          modelStatus.downloading = true;
          modelStatus.progress = Number(event.loaded) || 0;
          broadcastStatus();
        });
      },
    });
    translators.set(key, translator);
    modelStatus = {
      availability: 'available',
      downloading: false,
      progress: 1,
      error: null,
    };
    broadcastStatus();
    return translator;
  } catch (error) {
    modelStatus.downloading = false;
    modelStatus.error = error.message || 'Не удалось скачать пакеты';
    broadcastStatus();
    throw error;
  }
}

async function ensureModel(sourceLanguage, targetLanguage) {
  await refreshAvailability(sourceLanguage, targetLanguage);
  if (
    modelStatus.availability === 'unavailable' ||
    modelStatus.availability === 'unsupported'
  ) {
    return snapshotStatus();
  }
  if (
    modelStatus.availability === 'available' &&
    translators.has(pairKey(sourceLanguage, targetLanguage))
  ) {
    return snapshotStatus();
  }
  await getTranslator(sourceLanguage, targetLanguage);
  return snapshotStatus();
}

async function translateText(text, sourceLanguage, targetLanguage) {
  const translator = await getTranslator(sourceLanguage, targetLanguage);
  return translator.translate(text);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== 'offscreen') return;

  if (message.type === 'OFFSCREEN_AVAILABILITY') {
    getAvailabilityCompat(message.sourceLanguage, message.targetLanguage)
      .then((availability) => sendResponse({ availability }))
      .catch((error) =>
        sendResponse({ error: error.message || 'Не удалось проверить доступность' })
      );
    return true;
  }

  if (message.type === 'OFFSCREEN_MODEL_STATUS') {
    refreshAvailability(message.sourceLanguage, message.targetLanguage)
      .then((status) => sendResponse({ status }))
      .catch((error) =>
        sendResponse({ error: error.message || 'Не удалось проверить статус' })
      );
    return true;
  }

  if (message.type === 'OFFSCREEN_ENSURE_MODEL') {
    ensureModel(message.sourceLanguage, message.targetLanguage)
      .then((status) => sendResponse({ status }))
      .catch((error) =>
        sendResponse({ error: error.message || 'Не удалось скачать модель' })
      );
    return true;
  }

  if (message.type === 'OFFSCREEN_TRANSLATE') {
    translateText(message.text, message.sourceLanguage, message.targetLanguage)
      .then((translatedText) => sendResponse({ translatedText }))
      .catch((error) =>
        sendResponse({ error: error.message || 'Перевод Chrome не удался' })
      );
    return true;
  }
});

async function getAvailabilityCompat(sourceLanguage, targetLanguage) {
  const status = await refreshAvailability(sourceLanguage, targetLanguage);
  return status.availability;
}
