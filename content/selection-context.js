/** A "selection context" is the selected text plus where it lives and how to replace it. */

import { t } from '../i18n.js';
import { getDeepActiveElement } from './editable-dom.js';
import {
  getEditableButtonPosition,
  getEditableContext,
  replaceEditableSelection,
} from './field-editable.js';
import {
  getNativeButtonPosition,
  getNativeContext,
  replaceNativeSelection,
} from './field-native.js';

export function detect() {
  return getNativeContext(getDeepActiveElement()) || getEditableContext() || null;
}

export function clone(context) {
  if (context.type === 'native') {
    return { ...context, meta: { ...context.meta } };
  }
  return {
    ...context,
    meta: { ...context.meta, range: context.meta.range.cloneRange() },
  };
}

export function isCurrent(context) {
  if (context.type === 'native') {
    const { field, meta } = context;
    return (
      field.isConnected && field.value.slice(meta.start, meta.end) === context.text
    );
  }

  return Boolean(
    context.field?.isConnected &&
    context.meta.range.toString() === (context.meta.rangeText ?? context.text)
  );
}

export function isSame(first, second) {
  if (
    !first ||
    !second ||
    first.type !== second.type ||
    first.field !== second.field ||
    first.text !== second.text
  ) {
    return false;
  }

  if (first.type === 'native') {
    return first.meta.start === second.meta.start && first.meta.end === second.meta.end;
  }

  const a = first.meta.range;
  const b = second.meta.range;
  return (
    a.startContainer === b.startContainer &&
    a.startOffset === b.startOffset &&
    a.endContainer === b.endContainer &&
    a.endOffset === b.endOffset
  );
}

export function getButtonAnchor(context, event) {
  return context.type === 'native'
    ? getNativeButtonPosition(context, event)
    : getEditableButtonPosition(context);
}

export function applyTranslation(context, text) {
  if (context.type === 'native') {
    replaceNativeSelection(context, text);
    return;
  }
  if (!replaceEditableSelection(context, text)) {
    throw new Error(t('errorReplaceFailed'));
  }
}
