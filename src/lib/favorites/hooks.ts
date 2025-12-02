'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ArtistNode } from '@/types';

// localStorage key
export const FAVORITES_KEY = 'interchord-favorites';

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
      try {
        const stored = localStorage.getItem(FAVORITES_KEY);
        if (stored) {
          setFavorites(JSON.parse(stored));
        }
      } catch {
        // Ignore localStorage errors
      }
      setIsLoaded(true);
    };

    loadFavorites();

    // Listen for storage events to update favorites reactively (other tabs)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === FAVORITES_KEY) {
        try {
          if (e.newValue) {
            setFavorites(JSON.parse(e.newValue));
          } else {
            setFavorites([]);
          }
        } catch {
          // Ignore parse errors
        }
      }
    };

    // Listen for custom event for same-tab updates
    const handleCustomStorage = () => {
      try {
        const stored = localStorage.getItem(FAVORITES_KEY);
        if (stored) {
          setFavorites(JSON.parse(stored));
        } else {
          setFavorites([]);
        }
      } catch {
        // Ignore
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('favorites-updated', handleCustomStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('favorites-updated', handleCustomStorage);
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
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
        // Dispatch custom event for same-tab updates (deferred to avoid setState during render)
        setTimeout(() => window.dispatchEvent(new Event('favorites-updated')), 0);
      } catch {
        // Ignore storage errors
      }
      return updated;
    });
  }, []);

  // Remove a favorite
  const removeFavorite = useCallback((artistId: string) => {
    setFavorites((prev) => {
      const updated = prev.filter((f) => f.id !== artistId);
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
        // Dispatch custom event for same-tab updates (deferred to avoid setState during render)
        setTimeout(() => window.dispatchEvent(new Event('favorites-updated')), 0);
      } catch {
        // Ignore storage errors
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
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
        // Dispatch custom event for same-tab updates (deferred to avoid setState during render)
        setTimeout(() => window.dispatchEvent(new Event('favorites-updated')), 0);
      } catch {
        // Ignore storage errors
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
