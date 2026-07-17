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
  let lastHotkeyAt = 0;
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
    ui?.showToast('Перезагрузите страницу, чтобы использовать Input Translate');
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

    document.addEventListener('keydown', onHotkeyKeydown, true);

    try {
      chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'TRANSLATE_HOTKEY') onHotkeyTranslate();
      });
    } catch (error) {
      handleInvalidatedContext(error);
    }
  }

  function onHotkeyKeydown(event) {
    if (event.code !== 'KeyT' || !event.altKey || !event.shiftKey) return;
    if (event.ctrlKey || event.metaKey || event.repeat) return;
    event.preventDefault();
    event.stopPropagation();
    onHotkeyTranslate();
  }

  // Anchor = selection-start top-left. Button sits above-left of that point.
  function clampToViewport(x, y, dimensions = { width: 72, height: 44 }) {
    const margin = 8;
    const gap = 6;
    return {
      x: Math.min(Math.max(margin, x), window.innerWidth - dimensions.width - margin),
      y: Math.min(
        Math.max(margin, y - dimensions.height - gap),
        window.innerHeight - dimensions.height - margin
      ),
    };
  }

  function formatCount(value) {
    if (value == null || value === '…') return '…';
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function getButtonDimensions(counter) {
    return { width: Math.max(44, Math.max(52, counter.length * 6.5) + 12), height: 48 };
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

  async function showButton(anchor) {
    const context = activeContext;
    if (!context) return;
    const selectedChars = context.text.length;
    const renderVersion = ++buttonRenderVersion;
    const initialCounter = `${formatCount(selectedChars)}/${formatCount(null)}`;
    ui.setTranslate(selectedChars, null);
    ui.show(clampToViewport(anchor.x, anchor.y, getButtonDimensions(initialCounter)));

    try {
      const remaining = await runtime.getQuotaRemaining();
      if (renderVersion !== buttonRenderVersion || context !== activeContext) return;
      const counter = `${formatCount(selectedChars)}/${formatCount(remaining ?? '…')}`;
      ui.setTranslate(selectedChars, remaining);
      ui.updatePosition(
        clampToViewport(anchor.x, anchor.y, getButtonDimensions(counter))
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

    const now = Date.now();
    if (now - lastHotkeyAt < 400) return;
    lastHotkeyAt = now;

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
    isTranslating = true;
    buttonRenderVersion += 1;
    ui.setLoading();

    try {
      const response = await runtime.translate(snapshot.text);
      if (!contextTools.isCurrent(snapshot)) {
        throw new Error('Выделенный текст изменился; выделите его снова');
      }
      await contextTools.applyTranslation(snapshot, response.translatedText);
      hideButton();
    } catch (error) {
      if (handleInvalidatedContext(error)) return;
      hideButton();
      ui.showToast(error.message || 'Перевод не удался');
    } finally {
      isTranslating = false;
      activeContext = null;
      renderedContext = null;
    }
  }

  window.__inputTranslateContent = true;
})();
