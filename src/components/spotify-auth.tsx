'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { Loader2, Check, Music2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSpotifyAuth, useSpotifyCallback, getCuratedTopArtists, getFollowedArtists } from '@/lib/spotify';
import { searchArtists, getArtistById } from '@/lib/musicbrainz';
import { SPOTIFY_CONFIG } from '@/lib/spotify/config';
import {
  STORAGE_KEYS,
  SESSION_KEYS,
  STORAGE_EVENTS,
  getStorageItem,
  setStorageItem,
  getSessionItem,
  setSessionItem,
  removeSessionItem,
  dispatchStorageEvent,
} from '@/lib/storage';

// Persistent cache for import tracking
const SPOTIFY_IMPORT_CACHE_KEY = 'spotify-last-import';
const FULL_SYNC_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days for full re-sync
const BACKGROUND_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // Check for new artists every 4 hours

type ImportCache = {
  timestamp: number;
  artistCount: number;
  lastBackgroundCheck?: number;
  importedArtistIds: string[]; // Spotify artist IDs we've already processed
};

function getImportCache(): ImportCache | null {
  try {
    const cached = localStorage.getItem(SPOTIFY_IMPORT_CACHE_KEY);
    if (!cached) return null;
    return JSON.parse(cached);
  } catch {
    return null;
  }
}

function isImportCacheValid(): boolean {
  const cache = getImportCache();
  if (!cache) return false;
  return Date.now() - cache.timestamp < FULL_SYNC_DURATION_MS;
}

function shouldBackgroundCheck(): boolean {
  const cache = getImportCache();
  if (!cache) return false;
  const lastCheck = cache.lastBackgroundCheck || cache.timestamp;
  return Date.now() - lastCheck > BACKGROUND_CHECK_INTERVAL_MS;
}

function getImportedArtistIds(): string[] {
  const cache = getImportCache();
  return cache?.importedArtistIds || [];
}

function saveImportCache(artistCount: number, artistIds: string[]): void {
  const existingIds = getImportedArtistIds();
  const allIds = [...new Set([...existingIds, ...artistIds])];
  const cache: ImportCache = {
    timestamp: Date.now(),
    artistCount,
    importedArtistIds: allIds,
  };
  localStorage.setItem(SPOTIFY_IMPORT_CACHE_KEY, JSON.stringify(cache));
}

function updateBackgroundCheckTime(): void {
  const cache = getImportCache();
  if (cache) {
    cache.lastBackgroundCheck = Date.now();
    localStorage.setItem(SPOTIFY_IMPORT_CACHE_KEY, JSON.stringify(cache));
  }
}

function clearImportCache(): void {
  localStorage.removeItem(SPOTIFY_IMPORT_CACHE_KEY);
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Helper to add favorite directly to localStorage (works even when component unmounts)
function addFavoriteToStorage(artist: { id: string; name: string; type: string; country?: string; genres?: string[] }) {
  const favorites = getStorageItem<Array<{ id: string; name: string; type: string; country?: string; genres?: string[] }>>(STORAGE_KEYS.FAVORITES, []) ?? [];

  // Don't add if already exists
  if (favorites.some((f) => f.id === artist.id)) {
    return false;
  }

  favorites.push({
    id: artist.id,
    name: artist.name,
    type: artist.type,
    country: artist.country,
    genres: artist.genres,
  });

  const saved = setStorageItem(STORAGE_KEYS.FAVORITES, favorites);
  if (saved) {
    dispatchStorageEvent(STORAGE_EVENTS.FAVORITES_UPDATED);
  }
  return saved;
}

interface SpotifyAuthProps {
  onImportComplete?: () => void;
}

export function SpotifyAuth({ onImportComplete }: SpotifyAuthProps) {
  const { isConnected, isLoading, connect, disconnect } = useSpotifyAuth();
  const { error: callbackError, isProcessing, clearError } = useSpotifyCallback();
  const importInProgressRef = useRef(false);

  // Initialize state - check persistent cache first, then sessionStorage for in-progress imports
  const [isImporting, setIsImporting] = useState(() => {
    return getSessionItem<string>(SESSION_KEYS.SPOTIFY_IMPORTING) === 'true';
  });
  const [importStatus, setImportStatus] = useState<string | null>(() => {
    return getSessionItem<string>(SESSION_KEYS.SPOTIFY_IMPORT_STATUS);
  });
  const [hasImported, setHasImported] = useState(() => {
    // Check persistent cache first (survives browser restart)
    if (isImportCacheValid()) return true;
    // Fall back to session flag (for imports completed this session)
    return getSessionItem<string>(SESSION_KEYS.SPOTIFY_IMPORTED) === 'true';
  });

  // Poll for import status updates (in case import is running in background)
  useEffect(() => {
    if (!isImporting) return;

    const interval = setInterval(() => {
      const status = getSessionItem<string>(SESSION_KEYS.SPOTIFY_IMPORT_STATUS);
      const importing = getSessionItem<string>(SESSION_KEYS.SPOTIFY_IMPORTING) === 'true';
      const imported = getSessionItem<string>(SESSION_KEYS.SPOTIFY_IMPORTED) === 'true';

      if (status !== importStatus) {
        setImportStatus(status);
      }
      if (!importing && isImporting) {
        setIsImporting(false);
      }
      if (imported && !hasImported) {
        setHasImported(true);
        onImportComplete?.();
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isImporting, importStatus, hasImported, onImportComplete]);

  // Check if client ID is configured
  const isConfigured = !!SPOTIFY_CONFIG.clientId;

  // Helper to update import status in both state and sessionStorage
  const updateImportStatus = useCallback((status: string | null) => {
    setImportStatus(status);
    if (status) {
      setSessionItem(SESSION_KEYS.SPOTIFY_IMPORT_STATUS, status);
    } else {
      removeSessionItem(SESSION_KEYS.SPOTIFY_IMPORT_STATUS);
    }
  }, []);

  // Import artists from Spotify
  const importArtists = useCallback(async () => {
    // Check persistent cache, state, and sessionStorage to prevent duplicate imports
    const alreadyImported = hasImported || isImportCacheValid() || getSessionItem<string>(SESSION_KEYS.SPOTIFY_IMPORTED) === 'true';
    const alreadyImporting = isImporting || getSessionItem<string>(SESSION_KEYS.SPOTIFY_IMPORTING) === 'true' || importInProgressRef.current;

    if (alreadyImported || alreadyImporting) return;

    // Mark import as in progress in both state and sessionStorage
    importInProgressRef.current = true;
    setIsImporting(true);
    setSessionItem(SESSION_KEYS.SPOTIFY_IMPORTING, 'true');
    updateImportStatus('Fetching your top artists...');

    try {
      // Get curated list: Top 15 all-time + Top 15 last 6 months + Top 15 last 4 weeks (up to ~45 unique)
      let spotifyArtists = await getCuratedTopArtists(15);

      // If top artists is empty (not enough listening history), fall back to followed artists
      if (spotifyArtists.length === 0) {
        updateImportStatus('No top artists found. Fetching followed artists...');
        const followed = await getFollowedArtists();
        // Take first 50 followed artists
        spotifyArtists = followed.slice(0, 50);
      }

      if (spotifyArtists.length === 0) {
        updateImportStatus('No artists found in your Spotify library.');
        setHasImported(true);
        saveImportCache(0, []);
        setSessionItem(SESSION_KEYS.SPOTIFY_IMPORTED, 'true');
        removeSessionItem(SESSION_KEYS.SPOTIFY_IMPORTING);
        importInProgressRef.current = false;
        return;
      }

      updateImportStatus(`Found ${spotifyArtists.length} artists. Matching with MusicBrainz...`);

      let imported = 0;
      let processed = 0;
      const importedIds: string[] = [];

      for (const spotifyArtist of spotifyArtists) {
        processed++;
        updateImportStatus(`Matching "${spotifyArtist.name}" (${processed}/${spotifyArtists.length})...`);

        try {
          const mbResults = await searchArtists(spotifyArtist.name, 1);

          if (mbResults.length > 0) {
            const mbArtist = mbResults[0];

            // Fetch full artist data with genres from the artist API
            let genres = mbArtist.genres;
            try {
              const fullArtist = await getArtistById(mbArtist.id);
              if (fullArtist?.genres) {
                genres = fullArtist.genres;
              }
            } catch {
              // Continue with search result (genres will be undefined)
            }

            // Add directly to localStorage (works even if component unmounts)
            const wasAdded = addFavoriteToStorage({
              id: mbArtist.id,
              name: mbArtist.name,
              type: mbArtist.type,
              country: mbArtist.country,
              genres,
            });

            if (wasAdded) {
              imported++;
            }
            // Track Spotify ID for diff checking
            importedIds.push(spotifyArtist.spotifyId);
          }

          // Small delay to respect MusicBrainz rate limit (1 req/sec)
          await new Promise((resolve) => setTimeout(resolve, 1100));
        } catch {
          // Skip this artist on error
          console.warn(`Failed to match artist: ${spotifyArtist.name}`);
        }
      }

      const message = imported > 0
        ? `Added ${imported} new artist${imported !== 1 ? 's' : ''} to favorites!`
        : 'All artists already in favorites';

      updateImportStatus(message);
      setHasImported(true);
      saveImportCache(imported, importedIds);
      setSessionItem(SESSION_KEYS.SPOTIFY_IMPORTED, 'true');

      // Clear status after a few seconds
      setTimeout(() => {
        updateImportStatus(null);
        onImportComplete?.();
      }, 3000);
    } catch (err) {
      console.error('Error importing Spotify artists:', err);
      updateImportStatus('Failed to import artists. Please try again.');
    } finally {
      setIsImporting(false);
      removeSessionItem(SESSION_KEYS.SPOTIFY_IMPORTING);
      importInProgressRef.current = false;
    }
  }, [hasImported, isImporting, onImportComplete, updateImportStatus]);

  // Background diff sync - check for new artists without blocking UI
  const backgroundSync = useCallback(async () => {
    if (!shouldBackgroundCheck() || isImporting || importInProgressRef.current) {
      return;
    }

    try {
      const currentArtists = await getCuratedTopArtists(15);
      if (currentArtists.length === 0) {
        updateBackgroundCheckTime();
        return;
      }

      // Find new artists we haven't imported yet
      const alreadyImported = new Set(getImportedArtistIds());
      const newArtists = currentArtists.filter((a) => !alreadyImported.has(a.spotifyId));

      if (newArtists.length === 0) {
        updateBackgroundCheckTime();
        return;
      }

      // Import only the new artists quietly
      console.log(`Spotify: Found ${newArtists.length} new artists, syncing...`);
      let imported = 0;
      const newIds: string[] = [];

      for (const spotifyArtist of newArtists) {
        try {
          const mbResults = await searchArtists(spotifyArtist.name, 1);
          if (mbResults.length > 0) {
            const mbArtist = mbResults[0];

            // Fetch full artist data with genres
            let genres = mbArtist.genres;
            try {
              const fullArtist = await getArtistById(mbArtist.id);
              if (fullArtist?.genres) {
                genres = fullArtist.genres;
              }
            } catch {
              // Continue with search result
            }

            if (addFavoriteToStorage({
              id: mbArtist.id,
              name: mbArtist.name,
              type: mbArtist.type,
              country: mbArtist.country,
              genres,
            })) {
              imported++;
            }
            newIds.push(spotifyArtist.spotifyId);
          }
          await new Promise((resolve) => setTimeout(resolve, 1100));
        } catch {
          console.warn(`Background sync: Failed to match ${spotifyArtist.name}`);
        }
      }

      // Update cache with new IDs
      if (newIds.length > 0) {
        const cache = getImportCache();
        if (cache) {
          cache.importedArtistIds = [...new Set([...cache.importedArtistIds, ...newIds])];
          cache.lastBackgroundCheck = Date.now();
          cache.artistCount += imported;
          localStorage.setItem(SPOTIFY_IMPORT_CACHE_KEY, JSON.stringify(cache));
        }

        if (imported > 0) {
          updateImportStatus(`Added ${imported} new artist${imported !== 1 ? 's' : ''} from Spotify`);
          setTimeout(() => updateImportStatus(null), 5000);
        }
      } else {
        updateBackgroundCheckTime();
      }
    } catch (err) {
      console.error('Spotify background sync error:', err);
      updateBackgroundCheckTime();
    }
  }, [isImporting, updateImportStatus]);

  // Trigger import after connection
  useEffect(() => {
    if (isConnected) {
      if (!hasImported && !isImporting) {
        // First time import
        importArtists();
      } else if (shouldBackgroundCheck()) {
        // Already imported - do background diff check
        backgroundSync();
      }
    }
  }, [isConnected, hasImported, isImporting, importArtists, backgroundSync]);

  const handleConnect = async () => {
    clearError();
    await connect();
  };

  const handleDisconnect = () => {
    disconnect();
    setHasImported(false);
    setIsImporting(false);
    setImportStatus(null);
    importInProgressRef.current = false;
    clearImportCache();
    removeSessionItem(SESSION_KEYS.SPOTIFY_IMPORTED);
    removeSessionItem(SESSION_KEYS.SPOTIFY_IMPORTING);
    removeSessionItem(SESSION_KEYS.SPOTIFY_IMPORT_STATUS);
  };

  // Not configured - show setup message
  if (!isConfigured) {
    return (
      <Button variant="outline" disabled title="Spotify Client ID not configured">
        <Music2 className="size-4" />
        Connect Spotify (Not configured)
      </Button>
    );
  }

  // Loading state
  if (isLoading || isProcessing) {
    return (
      <Button variant="outline" disabled>
        <Loader2 className="animate-spin size-4" />
        {isProcessing ? 'Connecting...' : 'Loading...'}
      </Button>
    );
  }

  // Connected state
  if (isConnected) {
    const lastImport = getImportCache();

    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleDisconnect}
            className="text-green-600 border-green-600 hover:bg-green-50 dark:text-green-400 dark:border-green-400 dark:hover:bg-green-950"
          >
            <Check className="size-4" />
            Spotify Connected
          </Button>
        </div>
        {isImporting || importStatus ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            {isImporting && <Loader2 className="size-3 animate-spin" />}
            {importStatus}
          </div>
        ) : lastImport ? (
          <p className="text-xs text-muted-foreground">
            Synced {formatRelativeTime(new Date(lastImport.timestamp))}
          </p>
        ) : null}
      </div>
    );
  }

  // Disconnected state
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        onClick={handleConnect}
        className="hover:bg-green-50 hover:border-green-500 hover:text-green-700 dark:hover:bg-green-950 dark:hover:border-green-400 dark:hover:text-green-300"
      >
        <Music2 className="size-4" />
        Connect Spotify
      </Button>
      {callbackError && (
        <p className="text-sm text-destructive">{callbackError}</p>
      )}
    </div>
  );
}
