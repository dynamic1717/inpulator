/** Offscreen document host for Chrome Translator API (on-device). */

const translators = new Map();

/** @type {{ availability: string|null, downloading: boolean, progress: number, error: string|null }} */
let modelStatus = {
  availability: null,
  downloading: false,
  progress: 0,
  error: null,
};

/** True while Translator.create() is in flight — prevents polls from clearing download UI. */
let installInProgress = false;

function pairKey(source, target) {
  return `${source}|${target}`;
}

function pairLabel(source, target) {
  return `${String(source).toUpperCase()}→${String(target).toUpperCase()}`;
}

function packUnavailableMessage(sourceLanguage, targetLanguage) {
  return `Не удалось скачать языковой пакет Chrome для ${pairLabel(sourceLanguage, targetLanguage)}. Скачивание для этой пары недоступно.`;
}

function isGenericTranslatorFailure(error) {
  const raw = String(error?.message || error || '').toLowerCase();
  return (
    error?.name === 'UnknownError' ||
    error?.name === 'NotSupportedError' ||
    raw.includes('generic failure') ||
    raw.includes('not supported') ||
    raw.includes('unavailable')
  );
}

function formatTranslatorInstallError(error, sourceLanguage, targetLanguage) {
  const raw = String(error?.message || error || '');
  if (isGenericTranslatorFailure(error)) {
    return packUnavailableMessage(sourceLanguage, targetLanguage);
  }
  return raw || packUnavailableMessage(sourceLanguage, targetLanguage);
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

    if (installInProgress) {
      // Keep in-flight download progress; only refresh availability label.
    } else if (availability === 'available') {
      modelStatus.downloading = false;
      modelStatus.progress = 1;
    } else if (availability === 'downloading') {
      modelStatus.downloading = true;
    } else if (availability === 'downloadable' && !modelStatus.downloading) {
      modelStatus.progress = 0;
    }
  } catch (error) {
    installInProgress = false;
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
    throw new Error(packUnavailableMessage(sourceLanguage, targetLanguage));
  }

  const needsDownload =
    availability === 'downloadable' || availability === 'downloading';

  installInProgress = true;
  modelStatus.availability = availability;
  if (needsDownload) {
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
          const loaded = Math.min(1, Math.max(0, Number(event.loaded) || 0));
          modelStatus.progress = loaded;
          modelStatus.downloading = true;
          broadcastStatus();
        });
      },
    });
    translators.set(key, translator);
    installInProgress = false;
    modelStatus = {
      availability: 'available',
      downloading: false,
      progress: 1,
      error: null,
    };
    broadcastStatus();
    return translator;
  } catch (error) {
    installInProgress = false;
    modelStatus.downloading = false;

    let availability = modelStatus.availability;
    try {
      availability = await globalThis.Translator.availability({
        sourceLanguage,
        targetLanguage,
      });
      modelStatus.availability = availability;
    } catch {
      // Keep previous availability if the follow-up check fails.
    }

    const message =
      availability === 'unavailable'
        ? packUnavailableMessage(sourceLanguage, targetLanguage)
        : formatTranslatorInstallError(error, sourceLanguage, targetLanguage);
    modelStatus.error = message;
    if (availability === 'unavailable' || isGenericTranslatorFailure(error)) {
      modelStatus.availability = 'unavailable';
    }
    broadcastStatus();
    throw new Error(message);
  }
}

async function ensureModel(sourceLanguage, targetLanguage) {
  await refreshAvailability(sourceLanguage, targetLanguage);
  if (
    modelStatus.availability === 'unavailable' ||
    modelStatus.availability === 'unsupported'
  ) {
    if (modelStatus.availability === 'unavailable' && !modelStatus.error) {
      modelStatus.error = packUnavailableMessage(sourceLanguage, targetLanguage);
      broadcastStatus();
    }
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
