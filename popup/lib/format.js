/** Shared format helpers for the popup. */

export function formatLanguageLabel(lang) {
  return `${lang.flag} ${lang.name}`;
}

export function formatCount(value) {
  if (value == null) return '…';
  return Number(value).toLocaleString('en-US');
}

export function pairLabel(languagesApi, sourceCode, targetCode) {
  const source =
    languagesApi.getShortLabel?.(sourceCode) || String(sourceCode).toUpperCase();
  const target =
    languagesApi.getShortLabel?.(targetCode) || String(targetCode).toUpperCase();
  return `${source}→${target}`;
}
