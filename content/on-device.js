/**
 * On-device translation (Chrome Translator API) run in the page context.
 *
 * Why here and not in the offscreen document:
 * - Translator.create() needs a user gesture whenever availability is
 *   "downloadable"/"downloading". A click on the translate button is one;
 *   the offscreen document never has one, so it can't download packs.
 * - Availability is reported per origin: a pack already on disk still reads
 *   as "downloadable" for an origin that hasn't used it, so even downloaded
 *   packs need that gesture once per site.
 */

import { mapLanguageCodes } from '../translation/languages.js';
import { normalizeText, translateByLines } from '../translation/text-utils.js';

/** @type {Map<string, Promise<any>>} */
const translators = new Map();

export function isOnDeviceSupportedHere() {
  return 'Translator' in globalThis;
}

function createTranslator(pair, onProgress) {
  return globalThis.Translator.create({
    sourceLanguage: pair.source,
    targetLanguage: pair.target,
    monitor(monitor) {
      monitor.addEventListener('downloadprogress', (event) => {
        onProgress?.(Math.min(1, Math.max(0, Number(event.loaded) || 0)));
      });
    },
  });
}

function getTranslator(pair, onProgress) {
  const key = `${pair.source}|${pair.target}`;
  if (!translators.has(key)) {
    const pending = createTranslator(pair, onProgress);
    translators.set(key, pending);
    pending.catch(() => translators.delete(key));
  }
  return translators.get(key);
}

function dropTranslator(pair, translator) {
  translators.delete(`${pair.source}|${pair.target}`);
  try {
    translator?.destroy?.();
  } catch {
    // Already destroyed.
  }
}

async function translateWith(translator, text) {
  const { leadingWhitespace, content, trailingWhitespace } = normalizeText(text);
  const translated = await translateByLines(content, (line) =>
    translator.translate(line)
  );
  return `${leadingWhitespace}${translated}${trailingWhitespace}`;
}

/**
 * @param {string} text
 * @param {{ sourceLanguage: string, targetLanguage: string, onProgress?: (loaded: number) => void }} options
 * @returns {Promise<string>}
 * Rejects with NotAllowedError when a pack must be downloaded without a user
 * gesture, or when the page's permissions policy blocks the API.
 */
export async function translateOnDevice(
  text,
  { sourceLanguage, targetLanguage, onProgress }
) {
  const pair = mapLanguageCodes('chrome', {
    source: sourceLanguage,
    target: targetLanguage,
  });
  const translator = await getTranslator(pair, onProgress);
  try {
    return await translateWith(translator, text);
  } catch (error) {
    if (error?.name === 'NotAllowedError') throw error;
    // A cached instance can die (e.g. the model was unloaded) and then fails
    // with "Other generic failures occurred". Retry once with a fresh one.
    dropTranslator(pair, translator);
    return translateWith(await getTranslator(pair, onProgress), text);
  }
}
