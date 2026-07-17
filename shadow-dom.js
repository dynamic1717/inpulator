(function () {
  'use strict';

  if (window.__inputTranslateShadowDom) return;

  window.InputTranslate = window.InputTranslate || {};

  function markExtensionInvalidated() {
    window.__inputTranslateInvalidated = true;
  }

  function isExtensionContextValid() {
    if (window.__inputTranslateInvalidated) return false;

    try {
      return Boolean(chrome.runtime.id);
    } catch {
      markExtensionInvalidated();
      return false;
    }
  }

  // Avoid chrome.dom.openOrClosedShadowRoot — it throws when the extension
  // context is invalidated (e.g. after reloading the extension without
  // refreshing the tab). Selection-based tree walking handles closed shadow
  // roots without this API.
  function getShadowRoot(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return null;
    return element.shadowRoot || null;
  }

  function getDeepActiveElement(root = document) {
    let active = root.activeElement;
    if (!active) return null;

    while (active) {
      const shadow = getShadowRoot(active);
      if (shadow?.activeElement && shadow.activeElement !== active) {
        active = shadow.activeElement;
        continue;
      }
      break;
    }

    return active;
  }

  function isEditableElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
    if (element.getAttribute('aria-readonly') === 'true') return false;
    if (element.disabled) return false;

    if (
      element.isContentEditable &&
      element.getAttribute('contenteditable') !== 'false'
    ) {
      return true;
    }

    if (element.getAttribute('role') === 'textbox' && element.isContentEditable) {
      return true;
    }

    return false;
  }

  function findEditableFromNode(node) {
    let current = node;

    while (current) {
      if (current.nodeType === Node.ELEMENT_NODE && isEditableElement(current)) {
        return current;
      }

      if (current.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
        current = current.host || null;
        continue;
      }

      if (current.parentNode) {
        current = current.parentNode;
        continue;
      }

      const root = current.getRootNode?.();
      if (root instanceof ShadowRoot) {
        current = root.host;
        continue;
      }

      break;
    }

    return null;
  }

  function findEditableInTree(root) {
    if (!root) return null;
    if (isEditableElement(root)) return root;

    if (
      root.nodeType !== Node.ELEMENT_NODE &&
      root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE
    ) {
      return null;
    }

    for (const child of root.children) {
      if (isEditableElement(child)) return child;

      const shadow = getShadowRoot(child);
      if (shadow) {
        const found = findEditableInTree(shadow);
        if (found) return found;
      }

      const found = findEditableInTree(child);
      if (found) return found;
    }

    return null;
  }

  function findEditableNearFocus() {
    try {
      const active = getDeepActiveElement();
      if (!active) return null;

      if (isEditableElement(active)) return active;

      const editableFromActive = findEditableFromNode(active);
      if (editableFromActive) return editableFromActive;

      const shadow = getShadowRoot(active);
      if (shadow) {
        const focused = shadow.activeElement;
        if (focused) {
          const editable = findEditableFromNode(focused);
          if (editable) return editable;
        }

        return findEditableInTree(shadow);
      }

      return null;
    } catch {
      return null;
    }
  }

  window.InputTranslate.shadow = {
    getShadowRoot,
    getDeepActiveElement,
    isEditableElement,
    findEditableFromNode,
    findEditableInTree,
    findEditableNearFocus,
  };

  window.InputTranslate.extension = {
    isExtensionContextValid,
    markExtensionInvalidated,
  };

  window.__inputTranslateShadowDom = true;
})();
