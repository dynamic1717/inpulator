(function () {
  'use strict';

  if (window.__inputTranslateContent) return;

  const InputTranslate = window.InputTranslate || {};
  const contextTools = InputTranslate.selectionContext;
  const runtime = InputTranslate.runtimeClient;
  let activeContext = null;
  let renderedContext = null;
  let isTranslating = false;
  let buttonRenderVersion = 0;
  const ui = InputTranslate.floatingUi?.create({ onTranslate: onTranslateClick });

  init();

  function isActive() {
    return (
      !window.__inputTranslateInvalidated &&
      (InputTranslate.extension?.isExtensionContextValid() ?? true)
    );
  }

  function notifyReloadNeeded() {
    if (window.__inputTranslateReloadNotified) return;
    window.__inputTranslateReloadNotified = true;
    ui?.showToast('Reload page to use Input Translate');
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
    if (!isActive() || !contextTools || !runtime || !ui) return;

    InputTranslate.selectionObserver?.create({
      onSelectionChange: syncButtonWithSelection,
      onViewportChange: hideButton,
      isIgnoredTarget: (target) => ui.contains(target),
    });

    try {
      chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'TRANSLATE_HOTKEY') onHotkeyTranslate();
      });
    } catch (error) {
      handleInvalidatedContext(error);
    }
  }

  function clampToViewport(x, y, dimensions = { width: 72, height: 44 }) {
    const margin = 8;
    return {
      x: Math.min(
        Math.max(margin, x - dimensions.width / 2),
        window.innerWidth - dimensions.width - margin
      ),
      y: Math.min(Math.max(margin, y), window.innerHeight - dimensions.height - margin),
    };
  }

  function getButtonDimensions(counter) {
    return { width: Math.max(44, Math.max(52, counter.length * 6.5) + 12), height: 44 };
  }

  function syncButtonWithSelection(event) {
    if (!isActive()) return notifyReloadNeeded();
    if (isTranslating || ui.contains(event?.target)) return;

    try {
      const context = contextTools.detect();
      if (!contextTools.isTranslatable(context)) return hideButton();
      if (contextTools.isSame(renderedContext, context)) return;

      activeContext = contextTools.clone(context);
      renderedContext = contextTools.clone(context);
      showButton(contextTools.getButtonPosition(activeContext, event, clampToViewport));
    } catch (error) {
      if (!handleInvalidatedContext(error)) throw error;
    }
  }

  async function showButton(position) {
    const context = activeContext;
    if (!context) return;
    const selectedChars = context.text.length;
    const renderVersion = ++buttonRenderVersion;
    const initialCounter = `${selectedChars}/…`;
    ui.setTranslate(selectedChars, null);
    ui.show(
      clampToViewport(position.x, position.y, getButtonDimensions(initialCounter))
    );

    try {
      const remaining = await runtime.getQuotaRemaining();
      if (renderVersion !== buttonRenderVersion || context !== activeContext) return;
      const counter = `${selectedChars}/${remaining ?? '…'}`;
      ui.setTranslate(selectedChars, remaining);
      ui.updatePosition(
        clampToViewport(position.x, position.y, getButtonDimensions(counter))
      );
    } catch (error) {
      if (!handleInvalidatedContext(error)) return;
    }
  }

  function hideButton() {
    buttonRenderVersion += 1;
    ui?.hide();
    renderedContext = null;
    if (!isTranslating) activeContext = null;
  }

  async function onHotkeyTranslate() {
    if (!isActive()) return notifyReloadNeeded();
    if (isTranslating) return;

    try {
      let context = contextTools.detect();
      if (!contextTools.isTranslatable(context)) {
        context = await InputTranslate.clipboard?.captureSelectionText();
      }
      if (contextTools.isTranslatable(context)) await translateSelection(context);
    } catch (error) {
      if (!handleInvalidatedContext(error)) throw error;
    }
  }

  async function onTranslateClick() {
    if (activeContext && !isTranslating) await translateSelection(activeContext);
  }

  async function translateSelection(context) {
    const snapshot = contextTools.clone(context);
    const selectedChars = snapshot.text.length;
    isTranslating = true;
    buttonRenderVersion += 1;
    ui.setLoading();

    try {
      const response = await runtime.translate(snapshot.text);
      if (!contextTools.isCurrent(snapshot)) {
        throw new Error('Selected text changed; select it again');
      }
      await contextTools.applyTranslation(snapshot, response.translatedText);
      hideButton();
    } catch (error) {
      if (handleInvalidatedContext(error)) return;
      ui.showToast(error.message || 'Translation failed');
      runtime
        .getQuotaRemaining({ force: true })
        .then((remaining) => ui.setTranslate(selectedChars, remaining))
        .catch(() => ui.setTranslate(selectedChars, null));
    } finally {
      isTranslating = false;
      activeContext = null;
      renderedContext = null;
    }
  }

  window.__inputTranslateContent = true;
})();
