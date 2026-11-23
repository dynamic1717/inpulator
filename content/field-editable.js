/** contenteditable selection handling (Gmail, Slack, Notion, ChatGPT…). */

import {
  findEditableFromNode,
  findEditableNearFocus,
  isEditableElement,
} from './editable-dom.js';

// Range#toString() drops <br> and block boundaries ("Hello<div>World</div>"
// becomes "HelloWorld"); Selection#toString() keeps them as line breaks.
// rangeText is kept separately so isCurrent() can compare like with like.
function buildEditableContext(range, root, selection) {
  const rangeText = range.toString();
  const text = selection?.toString() || rangeText;
  if (!text.trim()) return null;

  return {
    type: 'editable',
    field: root,
    text,
    meta: { range: range.cloneRange(), rangeText },
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

  if (!root || !isEditableElement(root)) return null;

  return buildEditableContext(range, root, selection);
}

export function getEditableContext() {
  const fromSelection = getEditableContextFromSelection();
  if (fromSelection) return fromSelection;

  const focusedRoot = findEditableNearFocus();
  if (!focusedRoot) return null;

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  return buildEditableContext(range, focusedRoot, selection);
}

export function getEditableButtonPosition(context) {
  const rects = context.meta.range.getClientRects();
  const startRect = rects[0];

  if (!startRect || (startRect.width === 0 && startRect.height === 0)) {
    const fieldRect = context.field.getBoundingClientRect();
    return { x: fieldRect.left, y: fieldRect.top };
  }

  return { x: startRect.left, y: startRect.top };
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

// Rich editors (ProseMirror, Lexical, Slate, Draft, Quill) read
// event.clipboardData in their paste handlers and update their own model.
// A synthetic event never touches the system clipboard. Editors that handle
// it call preventDefault(); an unhandled event changes nothing.
function replaceViaSyntheticPaste(field, newText) {
  try {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', newText);
    const event = new ClipboardEvent('paste', {
      clipboardData,
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    return !field.dispatchEvent(event);
  } catch {
    return false;
  }
}

// Last resort: edit the DOM directly. May desync editors that keep a model.
function replaceViaDomRange(field, range, selection, newText) {
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
  return true;
}

export function replaceEditableSelection(context, newText) {
  const { field, meta } = context;
  const range = meta.range.cloneRange();
  const selection = window.getSelection();

  if (!selection) return false;

  selection.removeAllRanges();
  selection.addRange(range);
  field.focus();

  // execCommand emits its own input event. Dispatching another one causes
  // duplicate updates in controlled editors.
  if (document.execCommand('insertText', false, newText)) return true;
  if (replaceViaSyntheticPaste(field, newText)) return true;
  return replaceViaDomRange(field, range, selection, newText);
}
