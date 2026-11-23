/** Batches selection-related events into one debounced callback. */

// selectionchange fires on every caret move while typing or extending a
// selection; waiting for a short pause avoids running language detection on
// each intermediate state.
const SELECTION_DEBOUNCE_MS = 100;

export function createSelectionObserver({
  onSelectionChange,
  onViewportChange,
  isIgnoredTarget,
}) {
  let timerId = null;

  function schedule(event) {
    if (isIgnoredTarget?.(event?.target)) return;
    clearTimeout(timerId);
    timerId = setTimeout(() => {
      timerId = null;
      onSelectionChange(event);
    }, SELECTION_DEBOUNCE_MS);
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
      clearTimeout(timerId);
    },
  };
}
