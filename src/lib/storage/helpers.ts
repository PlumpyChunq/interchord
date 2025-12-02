/**
 * Storage helper utilities with SSR safety and error handling
 */

/**
 * Check if code is running on the client (browser)
 */
export function isClient(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Safely get an item from localStorage with JSON parsing
 * Returns null if not found, parsing fails, or on server
 */
export function getStorageItem<T>(key: string, defaultValue: T | null = null): T | null {
  if (!isClient()) return defaultValue;

  try {
    const item = localStorage.getItem(key);
    if (item === null) return defaultValue;
    return JSON.parse(item) as T;
  } catch (error) {
    console.warn(`[Storage] Failed to parse item "${key}":`, error);
    // Clear corrupted data
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore removal errors
    }
    return defaultValue;
  }
}

/**
 * Safely set an item in localStorage with JSON stringification
 */
export function setStorageItem<T>(key: string, value: T): boolean {
  if (!isClient()) return false;

  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`[Storage] Failed to set item "${key}":`, error);
    return false;
  }
}

/**
 * Safely remove an item from localStorage
 */
export function removeStorageItem(key: string): boolean {
  if (!isClient()) return false;

  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`[Storage] Failed to remove item "${key}":`, error);
    return false;
  }
}

/**
 * Safely get a raw string from localStorage (no JSON parsing)
 */
export function getStorageString(key: string, defaultValue: string | null = null): string | null {
  if (!isClient()) return defaultValue;

  try {
    return localStorage.getItem(key) ?? defaultValue;
  } catch (error) {
    console.warn(`[Storage] Failed to get string "${key}":`, error);
    return defaultValue;
  }
}

/**
 * Safely set a raw string in localStorage (no JSON stringification)
 */
export function setStorageString(key: string, value: string): boolean {
  if (!isClient()) return false;

  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`[Storage] Failed to set string "${key}":`, error);
    return false;
  }
}

/**
 * Safely get an item from sessionStorage with JSON parsing
 */
export function getSessionItem<T>(key: string, defaultValue: T | null = null): T | null {
  if (!isClient()) return defaultValue;

  try {
    const item = sessionStorage.getItem(key);
    if (item === null) return defaultValue;
    return JSON.parse(item) as T;
  } catch (error) {
    console.warn(`[Session] Failed to parse item "${key}":`, error);
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Ignore removal errors
    }
    return defaultValue;
  }
}

/**
 * Safely get a raw string from sessionStorage
 */
export function getSessionString(key: string, defaultValue: string | null = null): string | null {
  if (!isClient()) return defaultValue;

  try {
    return sessionStorage.getItem(key) ?? defaultValue;
  } catch (error) {
    console.warn(`[Session] Failed to get string "${key}":`, error);
    return defaultValue;
  }
}

/**
 * Safely set an item in sessionStorage (as string)
 */
export function setSessionString(key: string, value: string): boolean {
  if (!isClient()) return false;

  try {
    sessionStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`[Session] Failed to set string "${key}":`, error);
    return false;
  }
}

/**
 * Safely set an item in sessionStorage with JSON stringification
 */
export function setSessionItem<T>(key: string, value: T): boolean {
  if (!isClient()) return false;

  try {
    sessionStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`[Session] Failed to set item "${key}":`, error);
    return false;
  }
}

/**
 * Safely remove an item from sessionStorage
 */
export function removeSessionItem(key: string): boolean {
  if (!isClient()) return false;

  try {
    sessionStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`[Session] Failed to remove item "${key}":`, error);
    return false;
  }
}
