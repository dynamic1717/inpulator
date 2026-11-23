import { t } from '../../i18n.js';
import { normalizeText } from '../text-utils.js';

export function createChromeProvider({ sendToOffscreen } = {}) {
  if (typeof sendToOffscreen !== 'function') {
    throw new Error('createChromeProvider requires sendToOffscreen');
  }

  async function checkAvailability(pair) {
    const response = await sendToOffscreen({
      type: 'OFFSCREEN_AVAILABILITY',
      sourceLanguage: pair.source,
      targetLanguage: pair.target,
    });
    return response?.availability;
  }

  return {
    id: 'chrome',
    async isAvailable(pair) {
      try {
        const availability = await checkAvailability(pair);
        return (
          availability === 'available' ||
          availability === 'downloadable' ||
          availability === 'downloading'
        );
      } catch {
        return false;
      }
    },
    async getQuota() {
      return {
        charsUsed: 0,
        limit: null,
        remaining: null,
        period: 'none',
        provider: 'chrome',
      };
    },
    async translate(text, options) {
      const { leadingWhitespace, content, trailingWhitespace } = normalizeText(text);
      const response = await sendToOffscreen({
        type: 'OFFSCREEN_TRANSLATE',
        text: content,
        sourceLanguage: options.source,
        targetLanguage: options.target,
      });
      const translated = response?.translatedText;
      if (!translated) throw new Error(t('errorChromeTranslation'));
      return `${leadingWhitespace}${translated}${trailingWhitespace}`;
    },
  };
}
