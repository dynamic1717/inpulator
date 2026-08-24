/** Shared listbox helpers for custom dropdowns. */

import { appendLanguageLabel } from './format.js';

export function updateHighlight(options, highlightIndex) {
  for (let i = 0; i < options.length; i += 1) {
    options[i].setAttribute('aria-selected', i === highlightIndex ? 'true' : 'false');
  }
  options[highlightIndex]?.scrollIntoView({ block: 'nearest' });
}

export function createLanguageOption({
  languageId,
  lang,
  selected = false,
  onChoose,
  onHighlight,
}) {
  const item = document.createElement('li');
  item.className = 'popup__combobox-option';
  item.setAttribute('role', 'option');
  item.dataset.languageId = languageId;
  appendLanguageLabel(item, lang);
  item.setAttribute('aria-selected', selected ? 'true' : 'false');
  item.addEventListener('mousedown', (event) => {
    event.preventDefault();
  });
  item.addEventListener('click', () => {
    onChoose?.(languageId);
  });
  if (onHighlight) {
    item.addEventListener('mouseenter', onHighlight);
  }
  return item;
}

export function moveHighlight(currentIndex, optionCount, direction) {
  if (optionCount <= 0) return -1;
  if (direction > 0) {
    if (currentIndex < 0) return 0;
    return (currentIndex + 1) % optionCount;
  }
  if (currentIndex <= 0) return optionCount - 1;
  return currentIndex - 1;
}
