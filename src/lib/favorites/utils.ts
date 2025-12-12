/**
 * Standalone utility functions for favorites management.
 * These can be used outside of React components (e.g., in event handlers).
 * For reactive state, use the useFavorites() hook instead.
 */

import type { ArtistNode } from '@/types';
import type { StoredArtist } from './hooks';
import {
  STORAGE_KEYS,
  STORAGE_EVENTS,
  getStorageItem,
  setStorageItem,
  dispatchStorageEvent,
} from '@/lib/storage';

/**
 * Add an artist to favorites.
 * Dispatches storage events to update any listening components.
 */
export function addToFavorites(artist: ArtistNode | StoredArtist): void {
  const favorites = getStorageItem<StoredArtist[]>(STORAGE_KEYS.FAVORITES, []) ?? [];

  // Don't add if already exists
  if (favorites.some((f) => f.id === artist.id)) {
    return;
  }

  const newFavorite: StoredArtist = {
    id: artist.id,
    name: artist.name,
    type: artist.type,
    country: artist.country,
    genres: 'genres' in artist ? artist.genres : undefined,
  };

  const updated = [...favorites, newFavorite];

  if (setStorageItem(STORAGE_KEYS.FAVORITES, updated)) {
    // Dispatch events for both same-tab and cross-tab updates
    dispatchStorageEvent(STORAGE_EVENTS.FAVORITES_UPDATED);
  }
}

/**
 * Remove an artist from favorites by ID.
 * Dispatches storage events to update any listening components.
 */
export function removeFromFavorites(artistId: string): void {
  const favorites = getStorageItem<StoredArtist[]>(STORAGE_KEYS.FAVORITES, []) ?? [];
  const updated = favorites.filter((f) => f.id !== artistId);

  if (setStorageItem(STORAGE_KEYS.FAVORITES, updated)) {
    // Dispatch events for both same-tab and cross-tab updates
    dispatchStorageEvent(STORAGE_EVENTS.FAVORITES_UPDATED);
  }
}

/**
 * Check if an artist is in favorites.
 * This is a point-in-time check; for reactive updates use useFavorites().isFavorite()
 */
export function isFavorite(artistId: string): boolean {
  const favorites = getStorageItem<StoredArtist[]>(STORAGE_KEYS.FAVORITES, []) ?? [];
  return favorites.some((f) => f.id === artistId);
}

/**
 * Get all favorites (point-in-time snapshot).
 * For reactive updates, use useFavorites().favorites
 */
export function getFavorites(): StoredArtist[] {
  return getStorageItem<StoredArtist[]>(STORAGE_KEYS.FAVORITES, []) ?? [];
}

/**
 * Enrich a favorite artist with genres if they don't have any.
 * This is called when artist detail is loaded (which fetches tags from MusicBrainz).
 * Only updates if the artist is in favorites AND doesn't have genres yet.
 */
export function enrichFavoriteGenres(artistId: string, genres: string[] | undefined): void {
  if (!genres || genres.length === 0) return;

  const favorites = getStorageItem<StoredArtist[]>(STORAGE_KEYS.FAVORITES, []) ?? [];
  const index = favorites.findIndex((f) => f.id === artistId);

  if (index === -1) return; // Not a favorite

  const favorite = favorites[index];

  // Only update if favorite doesn't have genres or has an overrideGenre
  if (favorite.genres && favorite.genres.length > 0) return;

  // Update the favorite with genres
  const updated = [...favorites];
  updated[index] = { ...favorite, genres };

  if (setStorageItem(STORAGE_KEYS.FAVORITES, updated)) {
    dispatchStorageEvent(STORAGE_EVENTS.FAVORITES_UPDATED);
  }
}
