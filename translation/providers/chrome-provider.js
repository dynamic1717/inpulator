import { DEFAULT_LANGUAGE_PAIR } from '../provider.js';
import { normalizeText } from '../text-utils.js';

export function createChromeProvider({
  sendToOffscreen,
  languagePair = DEFAULT_LANGUAGE_PAIR,
} = {}) {
  if (typeof sendToOffscreen !== 'function') {
    throw new Error('createChromeProvider requires sendToOffscreen');
  }

  async function checkAvailability() {
    const response = await sendToOffscreen({
      type: 'OFFSCREEN_AVAILABILITY',
      sourceLanguage: languagePair.source,
      targetLanguage: languagePair.target,
    });
    return response?.availability;
  }

  return {
    id: 'chrome',
    async isAvailable() {
      try {
        const availability = await checkAvailability();
        return availability === 'available';
      } catch {
        return false;
      }
    },
    async getQuota() {
      return {
        charsUsed: 0,
        limit: null,
        dailyLimit: null,
        remaining: null,
        period: 'none',
        provider: 'chrome',
      };
    },
    async translate(text, options = languagePair) {
      const { leadingWhitespace, content, trailingWhitespace } = normalizeText(text);
      const response = await sendToOffscreen({
        type: 'OFFSCREEN_TRANSLATE',
        text: content,
        sourceLanguage: options.source,
        targetLanguage: options.target,
      });
      const translated = response?.translatedText;
      if (!translated) throw new Error('Перевод Chrome не удался');
      return `${leadingWhitespace}${translated}${trailingWhitespace}`;
    },
  };
}
