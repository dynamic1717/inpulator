(function () {
  'use strict';

  if (window.__inputTranslateContent) return;

  const InputTranslate = window.InputTranslate || {};
  const CYRILLIC_RE = /[\u0400-\u04FF]/;

  let activeContext = null;
  let isTranslating = false;
  let buttonRenderVersion = 0;
  const ui = InputTranslate.floatingUi?.create({ onTranslate: onTranslateClick });

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

  function isContextCurrent(context) {
    if (!context?.field?.isConnected && context.type !== 'clipboard') return false;

    if (context.type === 'native') {
      const { field, meta } = context;
      return field.value.slice(meta.start, meta.end) === context.text;
    }

    return context.meta?.range?.toString() === context.text;
  }

  let selectionChangeTimer = null;

  function syncButtonWithSelection(event) {
    if (!isActive()) return;
    if (isTranslating) return;
    if (event?.target && ui?.contains(event.target)) return;

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
    if (ui?.contains(event.target)) return;

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
    if (!ui) return;
    const renderVersion = ++buttonRenderVersion;
    ui.setTranslate(selectedChars, null);

    const initialDims = getButtonDimensions(`${selectedChars}/…`);
    const initialPosition = clampToViewport(position.x, position.y, initialDims);
    ui.show(initialPosition);

    const remaining = await fetchQuotaRemaining();
    if (renderVersion !== buttonRenderVersion || !activeContext) return;

    ui.setTranslate(selectedChars, remaining);

    const counterText =
      remaining != null ? `${selectedChars}/${remaining}` : `${selectedChars}/…`;
    const dims = getButtonDimensions(counterText);
    const adjusted = clampToViewport(position.x, position.y, dims);

    ui.updatePosition(adjusted);
  }

  function hideButton() {
    buttonRenderVersion += 1;
    ui?.hide();
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
    buttonRenderVersion += 1;

    ui?.setLoading();

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

      if (!isContextCurrent(snapshot)) {
        throw new Error('Selected text changed; select it again');
      }

      await applyTranslation(snapshot, response.translatedText);
      hideButton();
    } catch (error) {
      if (handleInvalidatedContext(error)) return;
      showToast(error.message || 'Translation failed');
      fetchQuotaRemaining().then((remaining) => {
        ui?.setTranslate(selectedChars, remaining);
      });
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
    ui?.showToast(message);
  }

  window.__inputTranslateContent = true;
})();
