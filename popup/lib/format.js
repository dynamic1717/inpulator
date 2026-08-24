/** Shared format helpers for the popup. */

export function getFlagUrl(lang) {
  const path = lang?.flag;
  if (!path) return null;
  return new URL(`../../${path}`, import.meta.url).href;
}

export function appendLanguageLabel(el, lang) {
  el.replaceChildren();
  el.classList.add('popup__lang-label');
  if (!lang) return;

  const url = getFlagUrl(lang);
  if (url) {
    const img = document.createElement('img');
    img.className = 'popup__flag';
    img.src = url;
    img.alt = '';
    img.width = 16;
    img.height = 12;
    img.decoding = 'async';
    el.append(img);
  }

  el.append(document.createTextNode(lang.name));
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
