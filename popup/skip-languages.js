import { appendLanguageLabel } from './lib/format.js';
import { createLanguageOption, moveHighlight, updateHighlight } from './lib/listbox.js';

export function createSkipLanguagesUi({
  pillsEl,
  suggestEl,
  suggestChip,
  suggestText,
  comboboxEl,
  inputEl,
  listEl,
  languagesApi,
  settingsApi,
  getSettings,
  getSelectionSourceLanguage,
  onSettingsChange,
}) {
  let highlightIndex = -1;
  let listOpen = false;

  function getExcludableLanguages(settings, query = '') {
    const disabled = new Set(settings.disabledSourceLanguages || []);
    const needle = String(query || '')
      .trim()
      .toLowerCase();
    return languagesApi.getShippedLanguages().filter((lang) => {
      if (disabled.has(lang.id)) return false;
      if (!needle) return true;
      const haystack = [lang.name, lang.shortLabel, lang.id]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }

  function setListOpen(open) {
    listOpen = open;
    listEl.hidden = !open;
    inputEl.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (!open) {
      highlightIndex = -1;
      for (const option of listEl.querySelectorAll('.popup__combobox-option')) {
        option.setAttribute('aria-selected', 'false');
      }
    }
  }

  function close() {
    setListOpen(false);
  }

  function contains(target) {
    return comboboxEl.contains(target) || listEl.contains(target);
  }

  async function addDisabledSource(languageId) {
    if (!languageId || !languagesApi.isShippedLanguageId(languageId)) return;
    const current = getSettings() || (await settingsApi.getSettings());
    if (current.disabledSourceLanguages.includes(languageId)) {
      render(current);
      return;
    }
    const next = await settingsApi.setSettings({
      disabledSourceLanguages: [...current.disabledSourceLanguages, languageId],
    });
    await onSettingsChange?.(next);
  }

  async function removeDisabledSource(languageId) {
    const current = getSettings() || (await settingsApi.getSettings());
    const next = await settingsApi.setSettings({
      disabledSourceLanguages: current.disabledSourceLanguages.filter(
        (id) => id !== languageId
      ),
    });
    await onSettingsChange?.(next);
  }

  function renderPills(settings) {
    const disabledIds = settings.disabledSourceLanguages || [];
    pillsEl.innerHTML = '';

    for (const id of disabledIds) {
      const lang = languagesApi.getLanguage(id);
      if (!lang) continue;

      const pill = document.createElement('span');
      pill.className = 'popup__pill';

      const text = document.createElement('span');
      text.className = 'popup__pill-text';
      appendLanguageLabel(text, lang);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'popup__pill-remove';
      remove.setAttribute('aria-label', `Enable ${lang.name}`);
      remove.textContent = '×';
      remove.addEventListener('click', (event) => {
        event.stopPropagation();
        removeDisabledSource(id);
      });

      pill.append(text, remove);
      pillsEl.appendChild(pill);
    }
  }

  function renderSuggest(settings) {
    const selectionSourceLanguage = getSelectionSourceLanguage();
    const lang = selectionSourceLanguage
      ? languagesApi.getLanguage(selectionSourceLanguage)
      : null;
    const disabled = new Set(settings.disabledSourceLanguages || []);
    const canSuggest = Boolean(lang) && !disabled.has(lang.id);

    suggestEl.hidden = !canSuggest;
    if (!canSuggest) return;

    appendLanguageLabel(suggestText, lang);
    suggestChip.setAttribute('aria-label', `Skip ${lang.name}`);
  }

  function renderList(settings) {
    const options = getExcludableLanguages(settings, inputEl.value);
    listEl.innerHTML = '';

    for (const lang of options) {
      listEl.appendChild(
        createLanguageOption({
          languageId: lang.id,
          lang,
          onChoose: async (languageId) => {
            await addDisabledSource(languageId);
            inputEl.value = '';
            setListOpen(false);
            inputEl.focus();
          },
        })
      );
    }

    if (options.length === 0) {
      highlightIndex = -1;
      setListOpen(false);
      return options;
    }

    if (highlightIndex >= options.length) {
      highlightIndex = options.length - 1;
    }
    if (listOpen && highlightIndex < 0) {
      highlightIndex = 0;
    }
    updateHighlight([...listEl.children], highlightIndex);
    return options;
  }

  function openList() {
    const settings = getSettings() || { disabledSourceLanguages: [] };
    const options = renderList(settings);
    if (options.length === 0) {
      setListOpen(false);
      return;
    }
    if (highlightIndex < 0) highlightIndex = 0;
    setListOpen(true);
    updateHighlight([...listEl.children], highlightIndex);
  }

  function render(settings) {
    renderPills(settings);
    renderSuggest(settings);
    if (listOpen) renderList(settings);
  }

  function bind() {
    suggestChip.addEventListener('click', async () => {
      const selectionSourceLanguage = getSelectionSourceLanguage();
      if (!selectionSourceLanguage) return;
      await addDisabledSource(selectionSourceLanguage);
    });

    comboboxEl.addEventListener('click', () => {
      inputEl.focus();
    });

    inputEl.addEventListener('focus', () => {
      openList();
    });

    inputEl.addEventListener('input', () => {
      openList();
    });

    inputEl.addEventListener('keydown', async (event) => {
      const options = [...listEl.querySelectorAll('.popup__combobox-option')];

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (!listOpen) openList();
        if (options.length === 0) return;
        highlightIndex = moveHighlight(highlightIndex, options.length, 1);
        updateHighlight(options, highlightIndex);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (!listOpen) openList();
        if (options.length === 0) return;
        highlightIndex = moveHighlight(highlightIndex, options.length, -1);
        updateHighlight(options, highlightIndex);
        return;
      }

      if (event.key === 'Enter') {
        if (!listOpen || highlightIndex < 0 || !options[highlightIndex]) return;
        event.preventDefault();
        const languageId = options[highlightIndex].dataset.languageId;
        await addDisabledSource(languageId);
        inputEl.value = '';
        setListOpen(false);
        return;
      }

      if (event.key === 'Escape') {
        if (!listOpen) return;
        event.preventDefault();
        setListOpen(false);
        return;
      }

      const settings = getSettings();
      if (
        event.key === 'Backspace' &&
        !inputEl.value &&
        (settings?.disabledSourceLanguages || []).length > 0
      ) {
        const disabled = settings.disabledSourceLanguages;
        await removeDisabledSource(disabled[disabled.length - 1]);
      }
    });

    inputEl.addEventListener('blur', () => {
      setTimeout(() => {
        if (
          document.activeElement === inputEl ||
          listEl.contains(document.activeElement)
        ) {
          return;
        }
        setListOpen(false);
      }, 0);
    });
  }

  return { bind, close, contains, render };
}
