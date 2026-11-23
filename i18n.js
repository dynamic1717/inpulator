/**
 * UI strings. Uses chrome.i18n (browser UI language, _locales/<lang>) in the
 * extension, and the English catalog where chrome.i18n is missing (Node tests).
 */

import english from './_locales/en/messages.json' with { type: 'json' };

/**
 * @param {string} key message name in _locales/<lang>/messages.json
 * @param {...(string|number)} substitutions fill $1, $2, …
 */
export function t(key, ...substitutions) {
  const values = substitutions.map(String);
  const message = globalThis.chrome?.i18n?.getMessage?.(key, values);
  if (message) return message;

  const fallback = english[key]?.message;
  if (!fallback) return key;
  return fallback.replace(/\$(\d)/g, (_, index) => values[Number(index) - 1] ?? '');
}

/** Fills [data-i18n], [data-i18n-placeholder] and [data-i18n-aria-label] in a page. */
export function localizeDocument(root = document) {
  document.documentElement.lang = globalThis.chrome?.i18n?.getUILanguage?.() || 'en';
  for (const element of root.querySelectorAll('[data-i18n]')) {
    element.textContent = t(element.dataset.i18n);
  }
  for (const element of root.querySelectorAll('[data-i18n-placeholder]')) {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  }
  for (const element of root.querySelectorAll('[data-i18n-aria-label]')) {
    element.setAttribute('aria-label', t(element.dataset.i18nAriaLabel));
  }
}
