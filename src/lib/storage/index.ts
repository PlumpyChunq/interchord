/**
 * Storage module - centralized storage management
 */

export { STORAGE_KEYS, SESSION_KEYS } from './keys';
export type { StorageKey, SessionKey } from './keys';

export { STORAGE_EVENTS, dispatchStorageEvent, addStorageEventListener } from './events';
export type { StorageEventName } from './events';

export {
  isClient,
  getStorageItem,
  setStorageItem,
  removeStorageItem,
  getStorageString,
  setStorageString,
  getSessionItem,
  setSessionItem,
  getSessionString,
  setSessionString,
  removeSessionItem,
} from './helpers';
