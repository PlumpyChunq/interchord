/**
 * Centralized custom event names
 * All custom events should be defined here to prevent typos and enable easy refactoring
 */

export const STORAGE_EVENTS = {
  FAVORITES_UPDATED: 'favorites-updated',
  PRIMARY_SERVICE_CHANGED: 'primary-service-changed',
  STREAMING_PREFERENCE_CHANGED: 'streaming-preference-changed',
} as const;

export type StorageEventName = typeof STORAGE_EVENTS[keyof typeof STORAGE_EVENTS];

/**
 * Type-safe event dispatcher
 */
export function dispatchStorageEvent(eventName: StorageEventName, detail?: unknown): void {
  if (typeof window === 'undefined') return;

  if (detail !== undefined) {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  } else {
    window.dispatchEvent(new Event(eventName));
  }
}

/**
 * Type-safe event listener
 */
export function addStorageEventListener(
  eventName: StorageEventName,
  handler: EventListener
): () => void {
  if (typeof window === 'undefined') return () => {};

  window.addEventListener(eventName, handler);
  return () => window.removeEventListener(eventName, handler);
}
