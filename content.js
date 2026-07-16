const CYRILLIC_RE = /[\u0400-\u04FF]/;

const TRANSLATE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>`;

const LOADING_ICON_SVG = `<svg class="input-translate-spinner" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="14 42"/></svg>`;

let button = null;
let toast = null;
let activeContext = null;
let isTranslating = false;

init();

function init() {
  document.addEventListener('mouseup', onSelectionChange, true);
  document.addEventListener('keyup', onSelectionChange, true);
  document.addEventListener('mousedown', onDocumentMouseDown, true);
  document.addEventListener('scroll', hideButton, true);
  window.addEventListener('resize', hideButton);

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'TRANSLATE_HOTKEY') {
      onHotkeyTranslate();
    }
  });
}

function detectSelectionContext() {
  const nativeContext = InputTranslate.native.getNativeContext(
    document.activeElement
  );
  if (nativeContext) return nativeContext;

  return InputTranslate.editable.getEditableContext();
}

function isTranslatableContext(context) {
  return (
    context &&
    context.text.trim() &&
    CYRILLIC_RE.test(context.text)
  );
}

function getButtonPosition(context, event) {
  if (context.type === 'native') {
    return InputTranslate.native.getNativeButtonPosition(
      context,
      event,
      clampToViewport
    );
  }

  return InputTranslate.editable.getEditableButtonPosition(
    context,
    clampToViewport
  );
}

function replaceContext(context, newText) {
  if (context.type === 'native') {
    InputTranslate.native.replaceNativeSelection(context, newText);
    return;
  }

  InputTranslate.editable.replaceEditableSelection(context, newText);
}

function onDocumentMouseDown(event) {
  if (button?.contains(event.target)) return;
  if (toast?.contains(event.target)) return;
  hideButton();
}

function onSelectionChange(event) {
  if (isTranslating) return;
  if (button?.contains(event.target)) return;

  requestAnimationFrame(() => {
    const context = detectSelectionContext();
    if (!isTranslatableContext(context)) {
      hideButton();
      return;
    }

    activeContext = context;
    showButton(getButtonPosition(context, event));
  });
}

function onHotkeyTranslate() {
  if (isTranslating) return;

  const context = detectSelectionContext();
  if (!isTranslatableContext(context)) return;

  translateSelection(context);
}

function clampToViewport(x, y) {
  const margin = 8;
  const buttonSize = 36;

  return {
    x: Math.min(
      Math.max(margin, x - buttonSize / 2),
      window.innerWidth - buttonSize - margin
    ),
    y: Math.min(
      Math.max(margin, y),
      window.innerHeight - buttonSize - margin
    ),
  };
}

function setButtonIcon(mode) {
  if (!button) return;
  button.innerHTML = mode === 'loading' ? LOADING_ICON_SVG : TRANSLATE_ICON_SVG;
}

function showButton(position) {
  if (!button) {
    button = document.createElement('button');
    button.id = 'input-translate-btn';
    button.type = 'button';
    button.title = 'Translate to English (Alt+Shift+T)';
    button.setAttribute('aria-label', 'Translate to English');
    button.addEventListener('mousedown', (e) => e.preventDefault());
    button.addEventListener('click', onTranslateClick);
    document.documentElement.appendChild(button);
  }

  setButtonIcon('translate');
  button.disabled = false;
  button.style.left = `${position.x}px`;
  button.style.top = `${position.y}px`;
  button.hidden = false;
}

function hideButton() {
  if (button) button.hidden = true;
  if (!isTranslating) activeContext = null;
}

async function onTranslateClick() {
  if (!activeContext || isTranslating) return;
  await translateSelection(activeContext);
}

async function translateSelection(context) {
  if (isTranslating) return;

  const snapshot = cloneContext(context);
  isTranslating = true;

  if (button) {
    button.disabled = true;
    setButtonIcon('loading');
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'TRANSLATE',
      text: snapshot.text,
    });

    if (chrome.runtime.lastError) {
      throw new Error(chrome.runtime.lastError.message);
    }
    if (response?.error) {
      throw new Error(response.error);
    }

    replaceContext(snapshot, response.translatedText);
    hideButton();
  } catch (error) {
    showToast(error.message || 'Translation failed');
    if (button) {
      button.disabled = false;
      setButtonIcon('translate');
    }
  } finally {
    isTranslating = false;
    activeContext = null;
  }
}

function cloneContext(context) {
  if (context.type === 'native') {
    return {
      type: 'native',
      field: context.field,
      text: context.text,
      meta: { ...context.meta },
    };
  }

  return {
    type: 'editable',
    field: context.field,
    text: context.text,
    meta: { range: context.meta.range.cloneRange() },
  };
}

function showToast(message) {
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'input-translate-toast';
    document.documentElement.appendChild(toast);
  }

  toast.textContent = message;
  toast.hidden = false;

  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.hidden = true;
  }, 3000);
}
