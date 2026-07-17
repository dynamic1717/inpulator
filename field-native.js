(function () {
  'use strict';

  if (window.__inputTranslateNative) return;

  window.InputTranslate = window.InputTranslate || {};

  const TRANSLATABLE_INPUT_TYPES = new Set([
    'text',
    'search',
    'email',
    'url',
    'tel',
    '',
  ]);

  function isNativeField(element) {
    if (!element) return false;

    if (element.tagName === 'TEXTAREA') {
      return !element.disabled && !element.readOnly;
    }

    if (element.tagName === 'INPUT') {
      const type = (element.type || 'text').toLowerCase();
      return (
        TRANSLATABLE_INPUT_TYPES.has(type) && !element.disabled && !element.readOnly
      );
    }

    return false;
  }

  function getNativeContext(activeElement) {
    if (!isNativeField(activeElement)) return null;

    const start = activeElement.selectionStart;
    const end = activeElement.selectionEnd;
    if (start == null || end == null || start === end) return null;

    return {
      type: 'native',
      field: activeElement,
      text: activeElement.value.slice(start, end),
      meta: { start, end },
    };
  }

  function clampButtonPosition(x, y) {
    const margin = 8;
    const buttonSize = 36;

    return {
      x: Math.min(
        Math.max(margin, x - buttonSize / 2),
        window.innerWidth - buttonSize - margin
      ),
      y: Math.min(Math.max(margin, y), window.innerHeight - buttonSize - margin),
    };
  }

  function getNativeButtonPosition(context, event, clampToViewport) {
    const clamp = clampToViewport || clampButtonPosition;
    const { field, meta } = context;
    const coords = getSelectionCoords(field, meta, clamp);
    if (coords) return coords;

    if (event?.clientX != null && event?.clientY != null) {
      return clamp(event.clientX, event.clientY - 40);
    }

    const rect = field.getBoundingClientRect();
    return clamp(rect.left + rect.width / 2, rect.top - 8);
  }

  function getSelectionCoords(field, selection, clamp) {
    if (field.tagName !== 'TEXTAREA' && field.tagName !== 'INPUT') return null;

    const div = document.createElement('div');
    const style = window.getComputedStyle(field);

    const properties = [
      'fontFamily',
      'fontSize',
      'fontWeight',
      'fontStyle',
      'letterSpacing',
      'textTransform',
      'wordSpacing',
      'textIndent',
      'whiteSpace',
      'wordWrap',
      'wordBreak',
      'overflowWrap',
      'paddingTop',
      'paddingRight',
      'paddingBottom',
      'paddingLeft',
      'borderTopWidth',
      'borderRightWidth',
      'borderBottomWidth',
      'borderLeftWidth',
      'boxSizing',
      'lineHeight',
      'textAlign',
      'direction',
    ];

    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = field.tagName === 'INPUT' ? 'pre' : 'pre-wrap';
    div.style.overflow = 'hidden';
    div.style.width = `${field.clientWidth}px`;

    for (const prop of properties) {
      div.style[prop] = style[prop];
    }

    const before = field.value.slice(0, selection.end);
    div.textContent = before;

    const marker = document.createElement('span');
    marker.textContent = field.value.slice(selection.end) || '.';
    div.appendChild(marker);

    document.body.appendChild(div);

    const fieldRect = field.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();
    const divRect = div.getBoundingClientRect();

    document.body.removeChild(div);

    const x = fieldRect.left + (markerRect.left - divRect.left) - field.scrollLeft;
    const y = fieldRect.top + (markerRect.top - divRect.top) - field.scrollTop;

    return clamp(x, y - 36);
  }

  function replaceNativeSelection(context, newText) {
    const { field, meta } = context;
    const { start, end } = meta;
    const value = field.value;

    const nextValue = value.slice(0, start) + newText + value.slice(end);
    const valueSetter = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(field),
      'value'
    )?.set;

    if (valueSetter) {
      valueSetter.call(field, nextValue);
    } else {
      field.value = nextValue;
    }

    const cursor = start + newText.length;
    field.setSelectionRange(cursor, cursor);
    field.focus();

    try {
      field.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          inputType: 'insertText',
          data: newText,
        })
      );
    } catch {
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  window.InputTranslate.native = {
    isNativeField,
    getNativeContext,
    getNativeButtonPosition,
    replaceNativeSelection,
  };

  window.__inputTranslateNative = true;
})();
