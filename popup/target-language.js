import { appendLanguageLabel } from './lib/format.js';
import { createLanguageOption, moveHighlight, updateHighlight } from './lib/listbox.js';

export function createTargetLanguageUi({
  trigger,
  valueEl,
  listEl,
  languagesApi,
  settingsApi,
  onChange,
}) {
  let selectedTargetLanguage = 'en';
  let listOpen = false;
  let highlightIndex = -1;

  function setDisplay(languageId) {
    selectedTargetLanguage = languageId;
    const lang = languagesApi.getLanguage(languageId);
    if (lang) {
      appendLanguageLabel(valueEl, lang);
      return;
    }
    valueEl.replaceChildren();
    valueEl.textContent = languageId;
  }

  function setListOpen(open) {
    listOpen = open;
    listEl.hidden = !open;
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (!open) {
      highlightIndex = -1;
      for (const option of listEl.querySelectorAll('.popup__combobox-option')) {
        option.setAttribute(
          'aria-selected',
          option.dataset.languageId === selectedTargetLanguage ? 'true' : 'false'
        );
      }
    }
  }

  function close() {
    setListOpen(false);
  }

  function contains(target) {
    return trigger.contains(target) || listEl.contains(target);
  }

  async function choose(languageId) {
    if (!languageId || languageId === selectedTargetLanguage) {
      setListOpen(false);
      return;
    }
    const next = await settingsApi.setSettings({ targetLanguage: languageId });
    setListOpen(false);
    await onChange?.(next);
  }

  function populate() {
    listEl.innerHTML = '';
    const languages = languagesApi.getShippedLanguages();

    languages.forEach((lang, index) => {
      listEl.appendChild(
        createLanguageOption({
          languageId: lang.id,
          lang,
          selected: lang.id === selectedTargetLanguage,
          onChoose: choose,
          onHighlight: () => {
            highlightIndex = index;
            updateHighlight([...listEl.children], highlightIndex);
          },
        })
      );
    });
  }

  function open() {
    populate();
    const options = [...listEl.children];
    highlightIndex = Math.max(
      0,
      options.findIndex(
        (option) => option.dataset.languageId === selectedTargetLanguage
      )
    );
    setListOpen(true);
    updateHighlight(options, highlightIndex);
  }

  function apply(settings) {
    setDisplay(settings.targetLanguage);
    populate();
  }

  function bind() {
    trigger.addEventListener('click', () => {
      if (listOpen) {
        setListOpen(false);
        return;
      }
      open();
    });

    trigger.addEventListener('keydown', async (event) => {
      const options = [...listEl.children];

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (!listOpen) {
          open();
          return;
        }
        highlightIndex = moveHighlight(highlightIndex, options.length, 1);
        updateHighlight(options, highlightIndex);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (!listOpen) {
          open();
          return;
        }
        highlightIndex = moveHighlight(highlightIndex, options.length, -1);
        updateHighlight(options, highlightIndex);
        return;
      }

      if (event.key === 'Enter' || event.key === ' ') {
        if (!listOpen) return;
        event.preventDefault();
        const languageId = options[highlightIndex]?.dataset.languageId;
        if (languageId) await choose(languageId);
        return;
      }

      if (event.key === 'Escape' && listOpen) {
        event.preventDefault();
        setListOpen(false);
      }
    });
  }

  return { apply, bind, close, contains, populate };
}
