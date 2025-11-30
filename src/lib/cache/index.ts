/**
 * Simple localStorage-based cache for MVP
 * Can be replaced with Redis later for production
 */

const CACHE_PREFIX = 'sam_cache_';
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

/**
 * Check if we're in a browser environment
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

/**
 * Get an item from cache
 */
export function cacheGet<T>(key: string): T | null {
  if (!isBrowser()) return null;

  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;

    const entry: CacheEntry<T> = JSON.parse(raw);

    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }

    return entry.data;
  } catch {
    return null;
  }
}

/**
 * Set an item in cache with TTL
 */
export function cacheSet<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
  if (!isBrowser()) return;

  try {
    const entry: CacheEntry<T> = {
      data,
      expiresAt: Date.now() + ttlMs,
    };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch (error) {
    // localStorage might be full or disabled
    console.warn('Cache write failed:', error);
  }
}

/**
 * Delete an item from cache
 */
export function cacheDelete(key: string): void {
  if (!isBrowser()) return;
  localStorage.removeItem(CACHE_PREFIX + key);
}

/**
 * Clear all cached items
 */
export function cacheClear(): void {
  if (!isBrowser()) return;

  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
}

/**
 * Cache TTL presets
 */
export const CacheTTL = {
  SHORT: 60 * 60 * 1000,           // 1 hour
  MEDIUM: 24 * 60 * 60 * 1000,     // 1 day
  LONG: 7 * 24 * 60 * 60 * 1000,   // 1 week
  ARTIST: 7 * 24 * 60 * 60 * 1000, // 1 week for artist data
} as const;
