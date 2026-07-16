const InputTranslate = (window.InputTranslate = window.InputTranslate || {});

function getContentEditableRoot(node) {
  let el = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;

  while (el) {
    if (el.isContentEditable && el.getAttribute('contenteditable') !== 'false') {
      return el;
    }
    el = el.parentElement;
  }

  return null;
}

function isEditableRoot(element) {
  if (!element?.isContentEditable) return false;
  if (element.getAttribute('contenteditable') === 'false') return false;
  if (element.getAttribute('aria-readonly') === 'true') return false;
  if (element.isContentEditable === false) return false;
  return true;
}

function getEditableContext() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const root = getContentEditableRoot(range.commonAncestorContainer);
  if (!root || !isEditableRoot(root)) return null;

  const text = range.toString();
  if (!text.trim()) return null;

  return {
    type: 'editable',
    field: root,
    text,
    meta: { range: range.cloneRange() },
  };
}

function getEditableButtonPosition(context, clampToViewport) {
  const rect = context.meta.range.getBoundingClientRect();

  if (rect.width === 0 && rect.height === 0) {
    const fieldRect = context.field.getBoundingClientRect();
    return clampToViewport(
      fieldRect.left + fieldRect.width / 2,
      fieldRect.top - 36
    );
  }

  return clampToViewport(rect.left + rect.width / 2, rect.top - 36);
}

function replaceEditableSelection(context, newText) {
  const { field, meta } = context;
  const range = meta.range.cloneRange();
  const selection = window.getSelection();

  selection.removeAllRanges();
  selection.addRange(range);
  field.focus();

  const inserted = document.execCommand('insertText', false, newText);

  if (!inserted) {
    range.deleteContents();
    const textNode = document.createTextNode(newText);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  field.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: newText,
    })
  );
}

InputTranslate.editable = {
  getEditableContext,
  getEditableButtonPosition,
  replaceEditableSelection,
};
