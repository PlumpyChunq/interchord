/**
 * Centralized localStorage and sessionStorage key constants
 * All storage keys should be defined here to prevent typos and enable easy refactoring
 */

// localStorage keys
export const STORAGE_KEYS = {
  // Favorites
  FAVORITES: 'interchord-favorites',

  // Genre preferences
  GENRE_ORDER: 'interchord-genre-order',
  EMPTY_GENRES: 'interchord-empty-genres',
  CUSTOM_GENRE_COLORS: 'interchord-custom-genre-colors',

  // Streaming preferences
  STREAMING_PREFERENCE: 'interchord-streaming-preference',
  PRIMARY_SERVICE: 'interchord-primary-service',

  // Search history
  RECENT_SEARCHES: 'interchord-recent-searches',
} as const;

// sessionStorage keys
export const SESSION_KEYS = {
  SPOTIFY_IMPORTED: 'spotify-imported',
  SPOTIFY_IMPORTING: 'spotify-importing',
  SPOTIFY_IMPORT_STATUS: 'spotify-import-status',
} as const;

// Type helpers
export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];
export type SessionKey = typeof SESSION_KEYS[keyof typeof SESSION_KEYS];
