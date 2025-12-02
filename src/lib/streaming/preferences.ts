'use client';

/**
 * Streaming service preference management
 * Stores user's preferred music streaming platform
 */

import {
  STORAGE_KEYS,
  STORAGE_EVENTS,
  isClient,
  getStorageString,
  setStorageString,
  dispatchStorageEvent,
} from '@/lib/storage';

export type StreamingService = 'apple-music' | 'spotify' | 'youtube-music' | 'amazon-music' | 'tidal';

// Legacy type for backwards compatibility with settings dropdown
export type MusicService = 'spotify' | 'apple-music' | null;

export interface StreamingServiceInfo {
  id: StreamingService;
  name: string;
  icon: string;
  getAlbumUrl: (artistName: string, albumName: string) => string;
  getArtistUrl: (artistName: string) => string;
}

export const STREAMING_SERVICES: Record<StreamingService, StreamingServiceInfo> = {
  'apple-music': {
    id: 'apple-music',
    name: 'Apple Music',
    icon: '🍎',
    getAlbumUrl: (artist, album) =>
      `https://music.apple.com/search?term=${encodeURIComponent(`${artist} ${album}`)}`,
    getArtistUrl: (artist) =>
      `https://music.apple.com/search?term=${encodeURIComponent(artist)}`,
  },
  'spotify': {
    id: 'spotify',
    name: 'Spotify',
    icon: '🟢',
    getAlbumUrl: (artist, album) =>
      `https://open.spotify.com/search/${encodeURIComponent(`${artist} ${album}`)}`,
    getArtistUrl: (artist) =>
      `https://open.spotify.com/search/${encodeURIComponent(artist)}`,
  },
  'youtube-music': {
    id: 'youtube-music',
    name: 'YouTube Music',
    icon: '▶️',
    getAlbumUrl: (artist, album) =>
      `https://music.youtube.com/search?q=${encodeURIComponent(`${artist} ${album}`)}`,
    getArtistUrl: (artist) =>
      `https://music.youtube.com/search?q=${encodeURIComponent(artist)}`,
  },
  'amazon-music': {
    id: 'amazon-music',
    name: 'Amazon Music',
    icon: '📦',
    getAlbumUrl: (artist, album) =>
      `https://music.amazon.com/search/${encodeURIComponent(`${artist} ${album}`)}`,
    getArtistUrl: (artist) =>
      `https://music.amazon.com/search/${encodeURIComponent(artist)}`,
  },
  'tidal': {
    id: 'tidal',
    name: 'Tidal',
    icon: '🌊',
    getAlbumUrl: (artist, album) =>
      `https://listen.tidal.com/search?q=${encodeURIComponent(`${artist} ${album}`)}`,
    getArtistUrl: (artist) =>
      `https://listen.tidal.com/search?q=${encodeURIComponent(artist)}`,
  },
};

const DEFAULT_SERVICE: StreamingService = 'apple-music';

/**
 * Get the user's preferred streaming service
 */
export function getStreamingPreference(): StreamingService {
  if (!isClient()) return DEFAULT_SERVICE;

  const stored = getStorageString(STORAGE_KEYS.STREAMING_PREFERENCE);
  if (stored && stored in STREAMING_SERVICES) {
    return stored as StreamingService;
  }
  return DEFAULT_SERVICE;
}

/**
 * Set the user's preferred streaming service
 */
export function setStreamingPreference(service: StreamingService): void {
  if (!isClient()) return;
  setStorageString(STORAGE_KEYS.STREAMING_PREFERENCE, service);
  dispatchStorageEvent(STORAGE_EVENTS.STREAMING_PREFERENCE_CHANGED, service);
}

/**
 * Get the streaming service info for the user's preference
 */
export function getPreferredService(): StreamingServiceInfo {
  return STREAMING_SERVICES[getStreamingPreference()];
}

/**
 * Get album URL for the user's preferred streaming service
 */
export function getAlbumStreamingUrl(artistName: string, albumName: string): string {
  const service = getPreferredService();
  return service.getAlbumUrl(artistName, albumName);
}

/**
 * Get artist URL for the user's preferred streaming service
 */
export function getArtistStreamingUrl(artistName: string): string {
  const service = getPreferredService();
  return service.getArtistUrl(artistName);
}

// ============================================================================
// Primary Service (for settings dropdown - which connected service to prefer)
// ============================================================================

/**
 * Get the primary music service (Spotify or Apple Music)
 * Used for playback links when both services are connected
 */
export function getPrimaryMusicService(): MusicService {
  if (!isClient()) return null;
  const stored = getStorageString(STORAGE_KEYS.PRIMARY_SERVICE);
  if (stored === 'spotify' || stored === 'apple-music') return stored;
  return null;
}

/**
 * Set the primary music service
 */
export function setPrimaryMusicService(service: MusicService): void {
  if (!isClient()) return;
  if (service) {
    setStorageString(STORAGE_KEYS.PRIMARY_SERVICE, service);
  } else {
    // Can't use removeStorageItem here since it's JSON, use raw localStorage
    try {
      localStorage.removeItem(STORAGE_KEYS.PRIMARY_SERVICE);
    } catch (error) {
      console.warn('[Storage] Failed to remove primary service:', error);
    }
  }
  dispatchStorageEvent(STORAGE_EVENTS.PRIMARY_SERVICE_CHANGED);
}
