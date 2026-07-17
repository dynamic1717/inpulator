(function () {
  'use strict';

  if (window.__inputTranslateSelectionObserver) return;

  window.InputTranslate = window.InputTranslate || {};

  function create({ onSelectionChange, onViewportChange, isIgnoredTarget }) {
    let frameId = null;

    function schedule(event) {
      if (isIgnoredTarget?.(event?.target)) return;
      if (frameId != null) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        frameId = null;
        onSelectionChange(event);
      });
    }

    function onDocumentSelectionChange() {
      schedule(null);
    }

    document.addEventListener('mouseup', schedule, true);
    document.addEventListener('keyup', schedule, true);
    document.addEventListener('selectionchange', onDocumentSelectionChange);
    document.addEventListener('scroll', onViewportChange, true);
    window.addEventListener('resize', onViewportChange);

    return {
      destroy() {
        document.removeEventListener('mouseup', schedule, true);
        document.removeEventListener('keyup', schedule, true);
        document.removeEventListener('selectionchange', onDocumentSelectionChange);
        document.removeEventListener('scroll', onViewportChange, true);
        window.removeEventListener('resize', onViewportChange);
        if (frameId != null) cancelAnimationFrame(frameId);
      },
    };
  }

  window.InputTranslate.selectionObserver = { create };
  window.__inputTranslateSelectionObserver = true;
})();
