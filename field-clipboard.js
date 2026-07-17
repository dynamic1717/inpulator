(function () {
  'use strict';

  if (window.__inputTranslateClipboard) return;

  window.InputTranslate = window.InputTranslate || {};

  function restoreSelection(range) {
    if (!range) return false;

    const selection = window.getSelection();
    if (!selection) return false;

    selection.removeAllRanges();
    selection.addRange(range.cloneRange());
    return true;
  }

  function replaceViaInsertText(newText, range) {
    if (!restoreSelection(range)) return false;
    return document.execCommand('insertText', false, newText);
  }

  async function replaceViaClipboardPaste(newText, range) {
    if (!restoreSelection(range)) return false;

    try {
      await navigator.clipboard.writeText(newText);
      return document.execCommand('paste');
    } catch {
      return false;
    }
  }

  async function replaceSelection(newText, range) {
    if (replaceViaInsertText(newText, range)) {
      return true;
    }

    return replaceViaClipboardPaste(newText, range);
  }

  function getSelectionRange() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      return null;
    }

    return selection.getRangeAt(0).cloneRange();
  }

  async function captureSelectionText() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return null;

    const text = selection.toString();
    if (text.trim()) {
      return {
        type: 'clipboard',
        field: null,
        text,
        meta: { range: selection.getRangeAt(0).cloneRange() },
      };
    }

    const range = getSelectionRange();
    if (!range) return null;

    try {
      document.execCommand('copy');
      const copiedText = await navigator.clipboard.readText();
      if (!copiedText.trim()) return null;

      return {
        type: 'clipboard',
        field: null,
        text: copiedText,
        meta: { range },
      };
    } catch {
      return null;
    }
  }

  window.InputTranslate.clipboard = {
    replaceSelection,
    captureSelectionText,
    restoreSelection,
  };

  window.__inputTranslateClipboard = true;
})();
