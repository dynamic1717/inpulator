(function () {
  'use strict';

  if (window.__inputTranslateContent) return;

  const InputTranslate = window.InputTranslate || {};
  const contextTools = InputTranslate.selectionContext;
  const runtime = InputTranslate.runtimeClient;
  const settingsApi = InputTranslate.settings;
  let activeContext = null;
  let renderedContext = null;
  let isTranslating = false;
  let buttonRenderVersion = 0;
  let selectionGateVersion = 0;
  let lastHotkeyAt = 0;
  let settings = { ...settingsApi?.DEFAULT_SETTINGS };
  const ui = InputTranslate.floatingUi?.create({ onTranslate: onTranslateClick });

  init();

  function isActive() {
    return (
      !window.__inputTranslateInvalidated &&
      (InputTranslate.extension?.isExtensionContextValid() ?? true)
    );
  }

  function isExtensionEnabled() {
    return settings?.enabled !== false && !isBlockedHost();
  }

  function isBlockedHost() {
    const host = window.location.hostname.toLowerCase();
    return settings?.blockedDomains?.some(
      (domain) => host === domain || host.endsWith(`.${domain}`)
    );
  }

  function handleInvalidatedContext(error) {
    if (!String(error?.message || error).includes('Extension context invalidated')) {
      return false;
    }
    window.__inputTranslateInvalidated = true;
    InputTranslate.extension?.markExtensionInvalidated?.();
    hideButton();
    return true;
  }

  async function init() {
    if (!isActive() || !contextTools || !runtime || !ui || !settingsApi) return;

    try {
      settings = await settingsApi.getSettings();
    } catch (error) {
      if (handleInvalidatedContext(error)) return;
      settings = { ...settingsApi.DEFAULT_SETTINGS };
    }

    settingsApi.subscribe(async (next) => {
      const providerChanged = next.provider !== settings.provider;
      settings = next;
      if (providerChanged) runtime.invalidateQuotaCache?.();
      if (!next.enabled) {
        hideButton();
        return;
      }
      if (
        activeContext &&
        (await contextTools.isTranslatable(activeContext, settings))
      ) {
        showButton(
          contextTools.getButtonPosition(activeContext, null, clampToViewport)
        );
      } else {
        hideButton();
      }
    });

    InputTranslate.selectionObserver?.create({
      onSelectionChange: syncButtonWithSelection,
      onViewportChange: hideButton,
      isIgnoredTarget: (target) => ui.contains(target),
    });

    // Chrome may leave Option+Shift shortcuts unbound on macOS. Capture the
    // in-page shortcut there so the generated character is not inserted.
    if (navigator.platform.includes('Mac')) {
      document.addEventListener('keydown', onMacHotkeyKeydown, true);
    }

    try {
      chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message.type === 'TRANSLATE_HOTKEY') {
          onHotkeyTranslate();
          return;
        }
        if (message.type === 'GET_SELECTION_LANGUAGE') {
          resolveSelectionLanguage()
            .then((sourceLanguage) => sendResponse({ sourceLanguage }))
            .catch(() => sendResponse({ sourceLanguage: null }));
          return true;
        }
      });
    } catch (error) {
      handleInvalidatedContext(error);
    }
  }

  async function resolveSelectionLanguage() {
    if (!isActive() || !contextTools) return null;
    const context = contextTools.detect();
    const text = context?.text?.trim();
    if (!text) return null;
    return (
      (await InputTranslate.languageDetect?.resolveSourceLanguage(context)) || null
    );
  }

  function onMacHotkeyKeydown(event) {
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

  function getButtonDimensions() {
    return { width: 44, height: 44 };
  }

  async function syncButtonWithSelection(event) {
    if (!isActive()) return hideButton();
    if (!isExtensionEnabled()) return hideButton();
    if (isTranslating || ui.contains(event?.target)) return;

    const gateVersion = ++selectionGateVersion;

    try {
      const context = contextTools.detect();
      if (!context?.text?.trim()) return hideButton();
      if (contextTools.isSame(renderedContext, context)) return;

      const translatable = await contextTools.isTranslatable(context, settings);
      if (gateVersion !== selectionGateVersion) return;
      if (!translatable) return hideButton();
      if (contextTools.isSame(renderedContext, context)) return;

      activeContext = contextTools.clone(context);
      renderedContext = contextTools.clone(context);
      showButton(contextTools.getButtonPosition(activeContext, event, clampToViewport));
    } catch (error) {
      if (!handleInvalidatedContext(error)) throw error;
    }
  }

  async function showButton(anchor) {
    if (!isExtensionEnabled()) return hideButton();

    const context = activeContext;
    if (!context) return;
    const renderVersion = ++buttonRenderVersion;
    const sourceLanguage =
      (await InputTranslate.languageDetect?.resolveSourceLanguage(context)) || 'ru';
    if (renderVersion !== buttonRenderVersion || context !== activeContext) return;
    const targetLanguage = settings.targetLanguage || 'en';
    ui.setTranslate({ sourceLanguage, targetLanguage });
    ui.show(clampToViewport(anchor.x, anchor.y, getButtonDimensions()));

    try {
      const quota = await runtime.getQuota();
      if (renderVersion !== buttonRenderVersion || context !== activeContext) return;
      ui.setTranslate({
        sourceLanguage,
        targetLanguage,
        quota,
      });
      ui.updatePosition(clampToViewport(anchor.x, anchor.y, getButtonDimensions()));
    } catch (error) {
      if (!handleInvalidatedContext(error)) return;
    }
  }

  function hideButton() {
    buttonRenderVersion += 1;
    selectionGateVersion += 1;
    ui?.hide();
    renderedContext = null;
    if (!isTranslating) activeContext = null;
  }

  async function onHotkeyTranslate() {
    if (!isActive() || !isExtensionEnabled() || isTranslating) return;

    const now = Date.now();
    if (now - lastHotkeyAt < 400) return;
    lastHotkeyAt = now;

    try {
      let context = contextTools.detect();
      if (!(await contextTools.isTranslatable(context, settings))) {
        context = await InputTranslate.clipboard?.captureSelectionText();
      }
      if (await contextTools.isTranslatable(context, settings)) {
        await translateSelection(context);
      }
    } catch (error) {
      if (!handleInvalidatedContext(error)) throw error;
    }
  }

  async function onTranslateClick() {
    if (!isExtensionEnabled()) return;
    if (activeContext && !isTranslating) await translateSelection(activeContext);
  }

  async function translateSelection(context) {
    const snapshot = contextTools.clone(context);
    isTranslating = true;
    buttonRenderVersion += 1;
    ui.setLoading();

    try {
      const sourceLanguage =
        (await InputTranslate.languageDetect?.resolveSourceLanguage(snapshot)) || null;
      if (!sourceLanguage) {
        throw new Error('Could not detect the text language');
      }
      const response = await runtime.translate(snapshot.text, { sourceLanguage });
      if (!contextTools.isCurrent(snapshot)) {
        throw new Error('The selection changed; select the text again');
      }
      await contextTools.applyTranslation(snapshot, response.translatedText);
      hideButton();
      activeContext = null;
      renderedContext = null;
    } catch (error) {
      if (handleInvalidatedContext(error)) return;
      ui.setError(error.message || 'Translation failed');
    } finally {
      isTranslating = false;
    }
  }

  window.__inputTranslateContent = true;
})();
