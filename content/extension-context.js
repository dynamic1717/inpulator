/**
 * After the extension reloads, this content script keeps running but every
 * chrome.* call throws "Extension context invalidated". Track that state so the
 * script can go quiet instead of throwing on every selection change.
 */

let invalidated = false;

export function markExtensionInvalidated() {
  invalidated = true;
}

export function isExtensionContextValid() {
  if (invalidated) return false;
  try {
    return Boolean(chrome.runtime.id);
  } catch {
    invalidated = true;
    return false;
  }
}

export function isInvalidatedContextError(error) {
  return String(error?.message || error).includes('Extension context invalidated');
}
