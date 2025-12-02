'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ArtistNode } from '@/types';
import {
  STORAGE_KEYS,
  STORAGE_EVENTS,
  getStorageItem,
  setStorageItem,
  addStorageEventListener,
  dispatchStorageEvent,
} from '@/lib/storage';

// Re-export for backwards compatibility
export const FAVORITES_KEY = STORAGE_KEYS.FAVORITES;

// Type for stored artist data (minimal version of ArtistNode)
export interface StoredArtist {
  id: string;
  name: string;
  type: string;
  country?: string;
  genres?: string[];  // Genre categories from MusicBrainz tags
  overrideGenre?: string;  // User-assigned genre (takes precedence over auto-detected)
}

interface UseFavoritesResult {
  favorites: StoredArtist[];
  favoriteNames: string[];
  addFavorite: (artist: ArtistNode | StoredArtist) => void;
  removeFavorite: (artistId: string) => void;
  updateArtistGenre: (artistId: string, genre: string | null) => void;
  isFavorite: (artistId: string) => boolean;
  isLoaded: boolean;
}

/**
 * Hook to manage favorite artists in localStorage
 * Includes reactive updates when localStorage changes in other tabs/windows
 */
export function useFavorites(): UseFavoritesResult {
  const [favorites, setFavorites] = useState<StoredArtist[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load favorites from localStorage on mount
  useEffect(() => {
    const loadFavorites = () => {
      const stored = getStorageItem<StoredArtist[]>(STORAGE_KEYS.FAVORITES, []);
      if (stored) {
        setFavorites(stored);
      }
      setIsLoaded(true);
    };

    loadFavorites();

    // Listen for storage events to update favorites reactively (other tabs)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.FAVORITES) {
        const stored = getStorageItem<StoredArtist[]>(STORAGE_KEYS.FAVORITES, []);
        setFavorites(stored ?? []);
      }
    };

    // Listen for custom event for same-tab updates
    const handleCustomStorage = () => {
      const stored = getStorageItem<StoredArtist[]>(STORAGE_KEYS.FAVORITES, []);
      setFavorites(stored ?? []);
    };

    window.addEventListener('storage', handleStorage);
    const removeCustomListener = addStorageEventListener(STORAGE_EVENTS.FAVORITES_UPDATED, handleCustomStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
      removeCustomListener();
    };
  }, []);

  // Add a favorite
  const addFavorite = useCallback((artist: ArtistNode | StoredArtist) => {
    const stored: StoredArtist = {
      id: artist.id,
      name: artist.name,
      type: artist.type,
      country: artist.country,
      genres: 'genres' in artist ? artist.genres : undefined,
    };

    setFavorites((prev) => {
      // Don't add if already exists
      if (prev.some((f) => f.id === artist.id)) {
        return prev;
      }
      const updated = [...prev, stored];
      if (setStorageItem(STORAGE_KEYS.FAVORITES, updated)) {
        // Dispatch custom event for same-tab updates (deferred to avoid setState during render)
        setTimeout(() => dispatchStorageEvent(STORAGE_EVENTS.FAVORITES_UPDATED), 0);
      }
      return updated;
    });
  }, []);

  // Remove a favorite
  const removeFavorite = useCallback((artistId: string) => {
    setFavorites((prev) => {
      const updated = prev.filter((f) => f.id !== artistId);
      if (setStorageItem(STORAGE_KEYS.FAVORITES, updated)) {
        // Dispatch custom event for same-tab updates (deferred to avoid setState during render)
        setTimeout(() => dispatchStorageEvent(STORAGE_EVENTS.FAVORITES_UPDATED), 0);
      }
      return updated;
    });
  }, []);

  // Update an artist's genre assignment (for drag-and-drop between sections)
  const updateArtistGenre = useCallback((artistId: string, genre: string | null) => {
    setFavorites((prev) => {
      const updated = prev.map((f) => {
        if (f.id === artistId) {
          return {
            ...f,
            overrideGenre: genre || undefined,
          };
        }
        return f;
      });
      if (setStorageItem(STORAGE_KEYS.FAVORITES, updated)) {
        // Dispatch custom event for same-tab updates (deferred to avoid setState during render)
        setTimeout(() => dispatchStorageEvent(STORAGE_EVENTS.FAVORITES_UPDATED), 0);
      }
      return updated;
    });
  }, []);

  // Check if an artist is a favorite
  const isFavorite = useCallback(
    (artistId: string) => favorites.some((f) => f.id === artistId),
    [favorites]
  );

  // Get just the names for convenience
  const favoriteNames = useMemo(
    () => favorites.map((f) => f.name),
    [favorites]
  );

  return {
    favorites,
    favoriteNames,
    addFavorite,
    removeFavorite,
    updateArtistGenre,
    isFavorite,
    isLoaded,
  };
}
