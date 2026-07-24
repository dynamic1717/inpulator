(function () {
  'use strict';

  if (window.__inputTranslateSelectionContext) return;

  window.InputTranslate = window.InputTranslate || {};

  function detect() {
    const nativeContext = window.InputTranslate.native?.getNativeContext(
      document.activeElement
    );
    if (nativeContext) return nativeContext;
    return window.InputTranslate.editable?.getEditableContext() || null;
  }

  async function isTranslatable(context, settings) {
    const detectApi = window.InputTranslate.languageDetect;
    if (detectApi?.isTranslatable) {
      return detectApi.isTranslatable(context, settings);
    }
    return Boolean(context?.text?.trim());
  }

  function clone(context) {
    if (context.type === 'native') {
      return { ...context, meta: { ...context.meta } };
    }

    return {
      ...context,
      meta: context.meta?.range ? { range: context.meta.range.cloneRange() } : {},
    };
  }

  function isCurrent(context) {
    if (context.type === 'native') {
      const { field, meta } = context;
      return (
        field.isConnected && field.value.slice(meta.start, meta.end) === context.text
      );
    }

    return Boolean(
      context.meta?.range &&
      (context.type === 'clipboard' || context.field?.isConnected) &&
      context.meta.range.toString() === context.text
    );
  }

  function isSame(first, second) {
    if (
      !first ||
      !second ||
      first.type !== second.type ||
      first.field !== second.field
    ) {
      return false;
    }
    if (first.text !== second.text) return false;

    if (first.type === 'native') {
      return (
        first.meta.start === second.meta.start && first.meta.end === second.meta.end
      );
    }

    const firstRange = first.meta?.range;
    const secondRange = second.meta?.range;
    return (
      firstRange?.startContainer === secondRange?.startContainer &&
      firstRange?.startOffset === secondRange?.startOffset &&
      firstRange?.endContainer === secondRange?.endContainer &&
      firstRange?.endOffset === secondRange?.endOffset
    );
  }

  function getButtonPosition(context, event, clampToViewport) {
    if (context.type === 'native') {
      return window.InputTranslate.native.getNativeButtonPosition(
        context,
        event,
        clampToViewport
      );
    }

    if (context.type === 'editable') {
      return window.InputTranslate.editable.getEditableButtonPosition(
        context,
        clampToViewport
      );
    }

    const startRect = context.meta?.range?.getClientRects()?.[0];
    if (startRect) return { x: startRect.left, y: startRect.top };
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }

  async function applyTranslation(context, text) {
    if (context.type === 'native') {
      window.InputTranslate.native.replaceNativeSelection(context, text);
      return;
    }

    if (context.type === 'editable') {
      const replaced =
        await window.InputTranslate.editable.replaceEditableSelectionWithFallback(
          context,
          text
        );
      if (replaced) return;
    }

    if (context.type === 'clipboard') {
      const replaced = await window.InputTranslate.clipboard?.replaceSelection(
        text,
        context.meta?.range
      );
      if (replaced) return;
    }

    throw new Error('Не удалось заменить текст');
  }

  window.InputTranslate.selectionContext = {
    detect,
    isTranslatable,
    clone,
    isCurrent,
    isSame,
    getButtonPosition,
    applyTranslation,
  };
  window.__inputTranslateSelectionContext = true;
})();
