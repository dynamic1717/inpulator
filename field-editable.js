(function () {
  'use strict';

  if (window.__inputTranslateEditable) return;

  window.InputTranslate = window.InputTranslate || {};

  const shadow = window.InputTranslate.shadow;
  if (!shadow) {
    window.InputTranslate.editable = {
      getEditableContext: () => null,
      getEditableButtonPosition: (_context, clampToViewport) =>
        clampToViewport(window.innerWidth / 2, window.innerHeight / 2),
      replaceEditableSelection: () => false,
      replaceEditableSelectionWithFallback: async () => false,
    };
    window.__inputTranslateEditable = true;
    return;
  }

  const { findEditableFromNode, findEditableNearFocus, isEditableElement } = shadow;

  function isEditableRoot(element) {
    return isEditableElement(element);
  }

  function buildEditableContext(range, root) {
    const text = range.toString();
    if (!text.trim()) return null;

    return {
      type: 'editable',
      field: root,
      text,
      meta: { range: range.cloneRange() },
    };
  }

  function getEditableContextFromSelection() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      return null;
    }

    const range = selection.getRangeAt(0);
    const root =
      findEditableFromNode(range.commonAncestorContainer) ||
      findEditableFromNode(selection.anchorNode) ||
      findEditableFromNode(selection.focusNode);

    if (!root || !isEditableRoot(root)) return null;

    return buildEditableContext(range, root);
  }

  function getEditableContext() {
    const fromSelection = getEditableContextFromSelection();
    if (fromSelection) return fromSelection;

    const focusedRoot = findEditableNearFocus();
    if (!focusedRoot) return null;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      return null;
    }

    const range = selection.getRangeAt(0);
    return buildEditableContext(range, focusedRoot);
  }

  function getEditableButtonPosition(context, clampToViewport) {
    const rect = context.meta.range.getBoundingClientRect();

    if (rect.width === 0 && rect.height === 0) {
      const fieldRect = context.field.getBoundingClientRect();
      return clampToViewport(fieldRect.left + fieldRect.width / 2, fieldRect.top - 36);
    }

    return clampToViewport(rect.left + rect.width / 2, rect.top - 36);
  }

  function dispatchInputEvent(field, newText) {
    if (!field) return;

    try {
      field.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          inputType: 'insertText',
          data: newText,
          composed: true,
        })
      );
    } catch {
      field.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }
  }

  function replaceEditableSelection(context, newText) {
    const { field, meta } = context;
    const range = meta.range.cloneRange();
    const selection = window.getSelection();

    if (!selection) return false;

    selection.removeAllRanges();
    selection.addRange(range);
    field.focus();

    const inserted = document.execCommand('insertText', false, newText);

    if (!inserted) {
      try {
        range.deleteContents();
        const textNode = document.createTextNode(newText);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      } catch {
        return false;
      }
      dispatchInputEvent(field, newText);
    }

    // execCommand emits its own input event. Dispatching another one causes
    // duplicate updates in controlled editors.
    return true;
  }

  async function replaceEditableSelectionWithFallback(context, newText) {
    if (replaceEditableSelection(context, newText)) {
      return true;
    }

    const clipboard = window.InputTranslate.clipboard;
    if (!clipboard) return false;

    const replaced = await clipboard.replaceSelection(newText, context.meta.range);

    if (replaced) return true;

    return false;
  }

  window.InputTranslate.editable = {
    getEditableContext,
    getEditableButtonPosition,
    replaceEditableSelection,
    replaceEditableSelectionWithFallback,
  };

  window.__inputTranslateEditable = true;
})();
