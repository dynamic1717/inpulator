/** Content script entry: shows the translate button and replaces selections. */

import { t } from '../i18n.js';
import {
  DEFAULT_SETTINGS,
  getSettings,
  isHostBlocked,
  setSettings,
  subscribeToSettings,
} from '../settings.js';
import {
  isExtensionContextValid,
  isInvalidatedContextError,
  markExtensionInvalidated,
} from './extension-context.js';
import { BUTTON_SIZE, createFloatingUi } from './floating-ui.js';
import { isTranslatable, resolveSourceLanguage } from './language.js';
import { isOnDeviceSupportedHere, translateOnDevice } from './on-device.js';
import * as runtime from './runtime-client.js';
import * as contextTools from './selection-context.js';
import { createSelectionObserver } from './selection-observer.js';
import { hasFocusedFieldText, selectWholeField } from './whole-field.js';

let activeContext = null;
let renderedContext = null;
let isTranslating = false;
let buttonRenderVersion = 0;
let selectionGateVersion = 0;
let lastHotkeyAt = 0;
let macFallbackEnabled = false;
let settings = { ...DEFAULT_SETTINGS };
const ui = createFloatingUi({
  onTranslate: onTranslateClick,
  // The settings subscription re-renders the button with the new pair.
  onPickLanguage: (targetLanguage) =>
    setSettings({ targetLanguage }).catch(handleInvalidatedContext),
});

// all_frames + match_origin_as_fallback can inject into the same frame only
// once, but guard anyway so a double injection never doubles the listeners.
if (!globalThis.__inpulatorContentStarted) {
  globalThis.__inpulatorContentStarted = true;
  init();
}

function isActive() {
  return isExtensionContextValid();
}

function isExtensionEnabled() {
  return settings?.enabled !== false && !isBlockedHost();
}

function isBlockedHost() {
  return isHostBlocked(window.location.hostname, settings.blockedDomains);
}

function handleInvalidatedContext(error) {
  if (!isInvalidatedContextError(error)) return false;
  markExtensionInvalidated();
  hideButton();
  return true;
}

async function init() {
  if (!isActive()) return;

  try {
    settings = await getSettings();
  } catch (error) {
    if (handleInvalidatedContext(error)) return;
  }

  subscribeToSettings(async (next) => {
    const providerChanged = next.provider !== settings.provider;
    settings = next;
    if (providerChanged) runtime.invalidateQuotaCache();
    if (!next.enabled) {
      hideButton();
      return;
    }
    if (activeContext && (await isTranslatable(activeContext, settings))) {
      showButton(contextTools.getButtonAnchor(activeContext, null));
    } else {
      hideButton();
    }
  });

  createSelectionObserver({
    onSelectionChange: syncButtonWithSelection,
    onViewportChange: hideButton,
    isIgnoredTarget: (target) => ui.contains(target),
  });

  // Chrome may leave Option+Shift shortcuts unbound on macOS. Capture the
  // in-page shortcut there so the generated character is not inserted —
  // but only while the command really is unbound (the user may have
  // remapped it, and then Option+Shift+T must type normally).
  if (isMac()) {
    refreshMacFallbackState();
    window.addEventListener('focus', refreshMacFallbackState);
    document.addEventListener('keydown', onMacHotkeyKeydown, true);
  }

  try {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'TRANSLATE_HOTKEY') {
        onHotkeyTranslate();
        return;
      }
      if (message.type === 'GET_SELECTION_LANGUAGE') {
        // With all_frames every frame receives this. Only a frame that has
        // a selection answers; others stay silent so they can't win the
        // race with a null response.
        if (!hasSelectedText()) return;
        resolveSelectionLanguage()
          .then((sourceLanguage) => sendResponse({ sourceLanguage }))
          .catch(() => sendResponse({ sourceLanguage: null }));
        return true;
      }
    });
  } catch (error) {
    handleInvalidatedContext(error);
  }

  // E2E builds only (removed from production bundles): tell tests that the
  // listeners are attached, since document_idle injection can land after load.
  if (__E2E__) document.documentElement.dataset.inpulatorReady = 'true';
}

async function resolveSelectionLanguage() {
  if (!isActive()) return null;
  return resolveSourceLanguage(contextTools.detect());
}

function hasSelectedText() {
  if (!isActive()) return false;
  return Boolean(contextTools.detect()?.text?.trim());
}

function isMac() {
  const platform = navigator.userAgentData?.platform || navigator.platform || '';
  return /mac/i.test(platform);
}

async function refreshMacFallbackState() {
  if (!isActive()) return;
  try {
    const response = await runtime.getTranslateShortcut();
    macFallbackEnabled = !response?.shortcut;
  } catch (error) {
    handleInvalidatedContext(error);
  }
}

function onMacHotkeyKeydown(event) {
  if (!macFallbackEnabled) return;
  if (event.code !== 'KeyT' || !event.altKey || !event.shiftKey) return;
  if (event.ctrlKey || event.metaKey || event.repeat) return;
  // Swallow the key only when we are going to act on it.
  if (!isActive() || !isExtensionEnabled()) return;
  if (!hasSelectedText() && !hasFocusedFieldText()) return;
  event.preventDefault();
  event.stopPropagation();
  onHotkeyTranslate();
}

// Anchor = selection-start top-left. The button sits just above that point.
function clampToViewport({ x, y }) {
  const margin = 8;
  const gap = 6;
  return {
    x: Math.min(Math.max(margin, x), window.innerWidth - BUTTON_SIZE - margin),
    y: Math.min(
      Math.max(margin, y - BUTTON_SIZE - gap),
      window.innerHeight - BUTTON_SIZE - margin
    ),
  };
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

    const translatable = await isTranslatable(context, settings);
    if (gateVersion !== selectionGateVersion) return;
    if (!translatable) return hideButton();
    if (contextTools.isSame(renderedContext, context)) return;

    activeContext = contextTools.clone(context);
    renderedContext = contextTools.clone(context);
    showButton(contextTools.getButtonAnchor(activeContext, event));
  } catch (error) {
    if (!handleInvalidatedContext(error)) throw error;
  }
}

async function showButton(anchor) {
  if (!isExtensionEnabled()) return hideButton();

  const context = activeContext;
  if (!context) return;
  const renderVersion = ++buttonRenderVersion;
  const sourceLanguage = await resolveSourceLanguage(context);
  if (renderVersion !== buttonRenderVersion || context !== activeContext) return;
  if (!sourceLanguage) return hideButton();
  const { targetLanguage } = settings;
  ui.setTranslate({ sourceLanguage, targetLanguage });
  ui.show(clampToViewport(anchor));

  try {
    const quota = await runtime.getQuota();
    if (renderVersion !== buttonRenderVersion || context !== activeContext) return;
    ui.setTranslate({
      sourceLanguage,
      targetLanguage,
      quota,
    });
    ui.updatePosition(clampToViewport(anchor));
  } catch (error) {
    if (!handleInvalidatedContext(error)) return;
  }
}

function hideButton() {
  buttonRenderVersion += 1;
  selectionGateVersion += 1;
  ui.hide();
  renderedContext = null;
  if (!isTranslating) activeContext = null;
}

async function onHotkeyTranslate() {
  if (!isActive() || !isExtensionEnabled() || isTranslating) return;

  const now = Date.now();
  if (now - lastHotkeyAt < 400) return;
  lastHotkeyAt = now;

  try {
    // Only text inside editable fields is translated in place. With a caret
    // but no selection, the whole field is selected and translated.
    let context = contextTools.detect();
    if (!context?.text?.trim() && selectWholeField()) context = contextTools.detect();
    if (await isTranslatable(context, settings)) {
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

async function requestTranslation(text, sourceLanguage) {
  if (settings.provider === 'chrome' && isOnDeviceSupportedHere()) {
    try {
      // Runs inside the click's user gesture, so missing packs download here.
      return await translateOnDevice(text, {
        sourceLanguage,
        targetLanguage: settings.targetLanguage,
        onProgress: (loaded) => ui.setLoading({ progress: loaded }),
      });
    } catch (error) {
      // No gesture (e.g. the Chrome command hotkey) or the page's permissions
      // policy blocks the API: fall back to the offscreen document, which
      // works when the pack is already usable for the extension.
      if (error?.name !== 'NotAllowedError') throw error;
    }
  }
  const response = await runtime.translate(text, { sourceLanguage });
  return response.translatedText;
}

async function translateSelection(context) {
  const snapshot = contextTools.clone(context);
  isTranslating = true;
  buttonRenderVersion += 1;
  ui.setLoading();

  try {
    const sourceLanguage = await resolveSourceLanguage(snapshot);
    if (!sourceLanguage) {
      throw new Error(t('errorLanguageNotDetected'));
    }
    const translatedText = await requestTranslation(snapshot.text, sourceLanguage);
    if (!contextTools.isCurrent(snapshot)) {
      throw new Error(t('errorSelectionChanged'));
    }
    contextTools.applyTranslation(snapshot, translatedText);
    hideButton();
    activeContext = null;
    renderedContext = null;
  } catch (error) {
    if (handleInvalidatedContext(error)) return;
    ui.setError(error.message || t('errorTranslationFailed'));
  } finally {
    isTranslating = false;
  }
}
