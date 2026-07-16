(function () {
  'use strict';

  if (window.__inputTranslateContent) return;

  const InputTranslate = window.InputTranslate || {};
  const CYRILLIC_RE = /[\u0400-\u04FF]/;

  const TRANSLATE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>`;

  const LOADING_ICON_SVG = `<svg class="input-translate-spinner" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="14 42"/></svg>`;

  let button = null;
  let toast = null;
  let activeContext = null;
  let isTranslating = false;

  init();

  function isActive() {
    if (window.__inputTranslateInvalidated) return false;
    return InputTranslate.extension?.isExtensionContextValid() ?? true;
  }

  function notifyReloadNeeded() {
    if (window.__inputTranslateReloadNotified) return;
    window.__inputTranslateReloadNotified = true;
    showToast('Reload page to use Input Translate');
  }

  function handleInvalidatedContext(error) {
    if (!String(error?.message || error).includes('Extension context invalidated')) {
      return false;
    }

    window.__inputTranslateInvalidated = true;
    InputTranslate.extension?.markExtensionInvalidated?.();
    notifyReloadNeeded();
    hideButton();
    return true;
  }

  function init() {
    if (!isActive()) return;

    document.addEventListener('mouseup', onPointerSelectionChange, true);
    document.addEventListener('keyup', onPointerSelectionChange, true);
    document.addEventListener('selectionchange', onDocumentSelectionChange);
    document.addEventListener('scroll', hideButton, true);
    window.addEventListener('resize', hideButton);

    try {
      chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'TRANSLATE_HOTKEY') {
          onHotkeyTranslate();
        }
      });
    } catch (error) {
      handleInvalidatedContext(error);
    }
  }

  function detectSelectionContext() {
    try {
      const native = InputTranslate.native;
      if (native) {
        const nativeContext = native.getNativeContext(document.activeElement);
        if (nativeContext) return nativeContext;
      }

      const editable = InputTranslate.editable;
      if (editable) {
        return editable.getEditableContext();
      }
    } catch (error) {
      if (handleInvalidatedContext(error)) return null;
      throw error;
    }

    return null;
  }

  function isTranslatableContext(context) {
    return (
      context &&
      context.text.trim() &&
      CYRILLIC_RE.test(context.text)
    );
  }

  function getButtonPosition(context, event) {
    if (context.type === 'native' && InputTranslate.native) {
      return InputTranslate.native.getNativeButtonPosition(
        context,
        event,
        clampToViewport
      );
    }

    if (context.type === 'editable' && InputTranslate.editable) {
      return InputTranslate.editable.getEditableButtonPosition(
        context,
        clampToViewport
      );
    }

    if (context.meta?.range) {
      const rect = context.meta.range.getBoundingClientRect();
      return clampToViewport(rect.left + rect.width / 2, rect.top - 36);
    }

    if (event?.clientX != null && event?.clientY != null) {
      return clampToViewport(event.clientX, event.clientY - 40);
    }

    return clampToViewport(window.innerWidth / 2, window.innerHeight / 2);
  }

  async function applyTranslation(context, newText) {
    if (context.type === 'native') {
      InputTranslate.native?.replaceNativeSelection(context, newText);
      return;
    }

    if (context.type === 'editable') {
      const replaced =
        await InputTranslate.editable?.replaceEditableSelectionWithFallback(
          context,
          newText
        );
      if (replaced) return;
      throw new Error('Could not replace text');
    }

    if (context.type === 'clipboard') {
      const replaced = await InputTranslate.clipboard?.replaceSelection(
        newText,
        context.meta?.range
      );
      if (replaced) return;
      throw new Error('Could not replace text');
    }
  }

  let selectionChangeTimer = null;

  function syncButtonWithSelection(event) {
    if (!isActive()) return;
    if (isTranslating) return;
    if (event?.target && button?.contains(event.target)) return;

    try {
      const context = detectSelectionContext();
      if (!isTranslatableContext(context)) {
        hideButton();
        return;
      }

      activeContext = cloneContext(context);
      showButton(getButtonPosition(activeContext, event), activeContext.text.length);
    } catch (error) {
      if (!handleInvalidatedContext(error)) throw error;
    }
  }

  function onPointerSelectionChange(event) {
    if (!isActive()) {
      notifyReloadNeeded();
      return;
    }
    if (isTranslating) return;
    if (button?.contains(event.target)) return;

    requestAnimationFrame(() => syncButtonWithSelection(event));
  }

  function onDocumentSelectionChange() {
    if (isTranslating) return;

    clearTimeout(selectionChangeTimer);
    selectionChangeTimer = setTimeout(() => {
      syncButtonWithSelection(null);
    }, 0);
  }

  async function onHotkeyTranslate() {
    if (!isActive()) {
      notifyReloadNeeded();
      return;
    }
    if (isTranslating) return;

    try {
      let context = detectSelectionContext();
      if (!isTranslatableContext(context)) {
        context = await InputTranslate.clipboard?.captureSelectionText();
      }
      if (!isTranslatableContext(context)) return;

      await translateSelection(context);
    } catch (error) {
      if (!handleInvalidatedContext(error)) throw error;
    }
  }

  function getButtonDimensions(counterText) {
    const counterWidth = Math.max(52, (counterText?.length || 7) * 6.5);
    return {
      width: Math.max(44, counterWidth + 12),
      height: 44,
    };
  }

  function clampToViewport(x, y, dimensions = { width: 72, height: 44 }) {
    const margin = 8;
    const { width: buttonWidth, height: buttonHeight } = dimensions;

    return {
      x: Math.min(
        Math.max(margin, x - buttonWidth / 2),
        window.innerWidth - buttonWidth - margin
      ),
      y: Math.min(
        Math.max(margin, y),
        window.innerHeight - buttonHeight - margin
      ),
    };
  }

  function setButtonContent(mode, selectedChars, remaining) {
    if (!button) return;

    if (mode === 'loading') {
      button.innerHTML = LOADING_ICON_SVG;
      button.classList.remove('input-translate-btn--with-counter');
      return;
    }

    const counter =
      remaining != null ? `${selectedChars}/${remaining}` : `${selectedChars}/…`;

    button.classList.add('input-translate-btn--with-counter');
    button.innerHTML = `${TRANSLATE_ICON_SVG}<span class="input-translate-counter">${counter}</span>`;
    button.title = `Translate to English (${counter} chars, Alt+Shift+T)`;
  }

  async function fetchQuotaRemaining() {
    try {
      const quota = await chrome.runtime.sendMessage({ type: 'GET_QUOTA' });
      if (chrome.runtime.lastError) return null;
      return quota?.remaining ?? null;
    } catch {
      return null;
    }
  }

  async function showButton(position, selectedChars) {
    if (!button) {
      button = document.createElement('button');
      button.id = 'input-translate-btn';
      button.type = 'button';
      button.setAttribute('aria-label', 'Translate to English');
      button.addEventListener('mousedown', (e) => e.preventDefault());
      button.addEventListener('click', onTranslateClick);
      document.documentElement.appendChild(button);
    }

    setButtonContent('translate', selectedChars, null);
    button.disabled = false;

    const remaining = await fetchQuotaRemaining();
    setButtonContent('translate', selectedChars, remaining);

    const counterText =
      remaining != null ? `${selectedChars}/${remaining}` : `${selectedChars}/…`;
    const dims = getButtonDimensions(counterText);
    const adjusted = clampToViewport(position.x, position.y, dims);

    button.style.left = `${adjusted.x}px`;
    button.style.top = `${adjusted.y}px`;
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
    const selectedChars = snapshot.text.length;
    isTranslating = true;

    if (button) {
      button.disabled = true;
      setButtonContent('loading', selectedChars, null);
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'TRANSLATE',
        text: snapshot.text,
      });

      if (chrome.runtime.lastError) {
        const lastError = chrome.runtime.lastError.message || '';
        if (lastError.includes('Extension context invalidated')) {
          throw new Error('Extension context invalidated');
        }
        throw new Error(lastError);
      }
      if (response?.error) {
        throw new Error(response.error);
      }

      await applyTranslation(snapshot, response.translatedText);
      hideButton();
    } catch (error) {
      if (handleInvalidatedContext(error)) return;
      showToast(error.message || 'Translation failed');
      if (button) {
        button.disabled = false;
        fetchQuotaRemaining().then((remaining) => {
          setButtonContent('translate', selectedChars, remaining);
        });
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

    if (context.type === 'editable') {
      return {
        type: 'editable',
        field: context.field,
        text: context.text,
        meta: { range: context.meta.range.cloneRange() },
      };
    }

    return {
      type: 'clipboard',
      field: null,
      text: context.text,
      meta: context.meta?.range
        ? { range: context.meta.range.cloneRange() }
        : {},
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

  window.__inputTranslateContent = true;
})();
