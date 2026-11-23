/**
 * "Translate the whole field": when the hotkey is pressed with a caret but no
 * selection, select everything in the focused field so the normal selection
 * flow (detection, translation, undoable replacement) handles it.
 */

import { getDeepActiveElement, isEditableElement } from './editable-dom.js';
import { isNativeField } from './field-native.js';

/**
 * The editor that owns the caret: the nearest ancestor with an explicit
 * contenteditable attribute. Pages like Notion nest one editable block per
 * paragraph inside a page-wide editable wrapper; this picks the block, not the page.
 */
function findCaretEditor() {
  const selection = window.getSelection();
  const node = selection?.rangeCount ? selection.getRangeAt(0).startContainer : null;
  const start = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  const editor = start?.closest('[contenteditable]:not([contenteditable="false"])');
  return editor && isEditableElement(editor) ? editor : null;
}

/** Selects the whole focused field. Returns false when there is nothing to select. */
export function selectWholeField() {
  const active = getDeepActiveElement();
  if (isNativeField(active)) {
    if (!active.value.trim()) return false;
    active.setSelectionRange(0, active.value.length);
    return true;
  }

  const editor = findCaretEditor();
  if (!editor?.textContent.trim()) return false;
  const range = document.createRange();
  range.selectNodeContents(editor);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

/** True when the hotkey has something to act on: a selection or a non-empty focused field. */
export function hasFocusedFieldText() {
  const active = getDeepActiveElement();
  if (isNativeField(active)) return Boolean(active.value.trim());
  return Boolean(findCaretEditor()?.textContent.trim());
}
