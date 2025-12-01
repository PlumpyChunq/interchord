'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useArtistSearch } from '@/lib/musicbrainz/hooks';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FavoritesRecentShows } from '@/components/favorites-recent-shows';
import type { ArtistNode } from '@/types';

// localStorage keys
const RECENT_SEARCHES_KEY = 'interchord-recent-searches';
const FAVORITES_KEY = 'interchord-favorites';
const MAX_RECENT_SEARCHES = 5;

// Types for stored data
interface StoredArtist {
  id: string;
  name: string;
  type: string;
  country?: string;
}

interface ArtistSearchProps {
  onSelectArtist: (artist: ArtistNode) => void;
}

export function ArtistSearch({ onSelectArtist }: ArtistSearchProps) {
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<StoredArtist[]>([]);
  const [favorites, setFavorites] = useState<StoredArtist[]>([]);

  const { data: results, isLoading, error } = useArtistSearch(searchQuery);

  // Load recent searches and favorites from localStorage on mount
  useEffect(() => {
    const loadFromStorage = () => {
      try {
        const storedRecent = localStorage.getItem(RECENT_SEARCHES_KEY);
        if (storedRecent) {
          setRecentSearches(JSON.parse(storedRecent));
        }
        const storedFavorites = localStorage.getItem(FAVORITES_KEY);
        if (storedFavorites) {
          setFavorites(JSON.parse(storedFavorites));
        }
      } catch {
        // Ignore localStorage errors
      }
    };

    loadFromStorage();

    // Listen for storage events to update favorites reactively
    const handleStorage = (e: StorageEvent) => {
      if (e.key === FAVORITES_KEY && e.newValue) {
        try {
          setFavorites(JSON.parse(e.newValue));
        } catch {
          // Ignore
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Save recent search when an artist is selected
  const saveRecentSearch = useCallback((artist: ArtistNode) => {
    const stored: StoredArtist = {
      id: artist.id,
      name: artist.name,
      type: artist.type,
      country: artist.country,
    };

    setRecentSearches((prev) => {
      // Remove if already exists, then add to front
      const filtered = prev.filter((a) => a.id !== stored.id);
      const updated = [stored, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      } catch {
        // Ignore localStorage errors
      }
      return updated;
    });
  }, []);

  const handleSearch = useCallback(() => {
    if (inputValue.trim().length >= 2) {
      setSearchQuery(inputValue.trim());
    }
  }, [inputValue]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleSelectArtist = useCallback(
    (artist: ArtistNode) => {
      saveRecentSearch(artist);
      onSelectArtist(artist);
    },
    [saveRecentSearch, onSelectArtist]
  );

  const handleQuickSelect = useCallback(
    (stored: StoredArtist) => {
      // Convert StoredArtist to ArtistNode
      const artist: ArtistNode = {
        id: stored.id,
        name: stored.name,
        type: stored.type as 'person' | 'group',
        loaded: false,
        country: stored.country,
      };
      saveRecentSearch(artist);
      onSelectArtist(artist);
    },
    [saveRecentSearch, onSelectArtist]
  );

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      // Ignore
    }
  }, []);

  // Extract artist names for the concerts hook
  const favoriteArtistNames = useMemo(
    () => favorites.map((f) => f.name),
    [favorites]
  );

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <div className="flex gap-2">
        <Input
          type="search"
          placeholder="Search for an artist (e.g., Butthole Surfers)"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
        />
        <Button onClick={handleSearch} disabled={inputValue.length < 2 || isLoading}>
          {isLoading ? 'Searching...' : 'Search'}
        </Button>
      </div>

      {/* Favorites Section */}
      {favorites.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-amber-600 font-medium">Favorites</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {favorites.map((artist) => (
              <Button
                key={artist.id}
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect(artist)}
                className="text-xs border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-700"
              >
                <span className="mr-1">&#9733;</span>
                {artist.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Recent Searches Section */}
      {recentSearches.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Recent Searches</span>
            <button
              onClick={clearRecentSearches}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((artist) => (
              <Button
                key={artist.id}
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect(artist)}
                className="text-xs"
              >
                {artist.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Recent Shows from Favorites */}
      {favoriteArtistNames.length > 0 && !searchQuery && (
        <FavoritesRecentShows artistNames={favoriteArtistNames} />
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          Error: {error.message}
        </div>
      )}

      {results && results.length === 0 && searchQuery && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-gray-600">
          No artists found for &quot;{searchQuery}&quot;
        </div>
      )}

      {results && results.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">
            Found {results.length} result{results.length !== 1 ? 's' : ''} for &quot;{searchQuery}&quot;
          </p>
          <div className="grid gap-2">
            {results.map((artist) => (
              <Card
                key={artist.id}
                className="cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => handleSelectArtist(artist)}
              >
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{artist.name}</CardTitle>
                      {artist.disambiguation && (
                        <CardDescription>{artist.disambiguation}</CardDescription>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                        {artist.type}
                      </span>
                      {artist.country && (
                        <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                          {artist.country}
                        </span>
                      )}
                    </div>
                  </div>
                  {artist.activeYears?.begin && (
                    <p className="text-xs text-gray-400 mt-1">
                      {artist.activeYears.begin}
                      {artist.activeYears.end ? ` – ${artist.activeYears.end}` : ' – present'}
                    </p>
                  )}
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Export helper functions for use in other components
export function addToFavorites(artist: ArtistNode | StoredArtist): void {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    const favorites: StoredArtist[] = stored ? JSON.parse(stored) : [];

    const newFavorite: StoredArtist = {
      id: artist.id,
      name: artist.name,
      type: artist.type,
      country: 'country' in artist ? artist.country : undefined,
    };

    // Don't add if already exists
    if (favorites.some((f) => f.id === newFavorite.id)) {
      return;
    }

    const updated = [...favorites, newFavorite];
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));

    // Dispatch storage event to update other components
    window.dispatchEvent(new StorageEvent('storage', {
      key: FAVORITES_KEY,
      newValue: JSON.stringify(updated),
    }));
  } catch {
    // Ignore localStorage errors
  }
}

export function removeFromFavorites(artistId: string): void {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    const favorites: StoredArtist[] = stored ? JSON.parse(stored) : [];

    const updated = favorites.filter((f) => f.id !== artistId);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));

    // Dispatch storage event to update other components
    window.dispatchEvent(new StorageEvent('storage', {
      key: FAVORITES_KEY,
      newValue: JSON.stringify(updated),
    }));
  } catch {
    // Ignore localStorage errors
  }
}

export function isFavorite(artistId: string): boolean {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    const favorites: StoredArtist[] = stored ? JSON.parse(stored) : [];
    return favorites.some((f) => f.id === artistId);
  } catch {
    return false;
  }
}
