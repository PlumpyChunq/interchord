'use client';

/**
 * Streaming service preference management
 * Stores user's preferred music streaming platform
 */

export type StreamingService = 'apple-music' | 'spotify' | 'youtube-music' | 'amazon-music' | 'tidal';

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

const STORAGE_KEY = 'interchord-streaming-preference';
const DEFAULT_SERVICE: StreamingService = 'apple-music';

/**
 * Get the user's preferred streaming service
 */
export function getStreamingPreference(): StreamingService {
  if (typeof window === 'undefined') return DEFAULT_SERVICE;

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && stored in STREAMING_SERVICES) {
    return stored as StreamingService;
  }
  return DEFAULT_SERVICE;
}

/**
 * Set the user's preferred streaming service
 */
export function setStreamingPreference(service: StreamingService): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, service);

  // Dispatch custom event so components can react
  window.dispatchEvent(new CustomEvent('streaming-preference-changed', { detail: service }));
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
