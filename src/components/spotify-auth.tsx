'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { Loader2, Check, Music2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSpotifyAuth, useSpotifyCallback, getCuratedTopArtists, getFollowedArtists } from '@/lib/spotify';
import { searchArtists } from '@/lib/musicbrainz/client';
import { SPOTIFY_CONFIG } from '@/lib/spotify/config';

// Storage keys
const FAVORITES_KEY = 'interchord-favorites';
const SPOTIFY_IMPORTED_KEY = 'spotify-imported';
const SPOTIFY_IMPORTING_KEY = 'spotify-importing';
const SPOTIFY_IMPORT_STATUS_KEY = 'spotify-import-status';

// Helper to add favorite directly to localStorage (works even when component unmounts)
function addFavoriteToStorage(artist: { id: string; name: string; type: string; country?: string; genres?: string[] }) {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    const favorites = stored ? JSON.parse(stored) : [];

    // Don't add if already exists
    if (favorites.some((f: { id: string }) => f.id === artist.id)) {
      return false;
    }

    favorites.push({
      id: artist.id,
      name: artist.name,
      type: artist.type,
      country: artist.country,
      genres: artist.genres,
    });

    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    window.dispatchEvent(new Event('favorites-updated'));
    return true;
  } catch {
    return false;
  }
}

interface SpotifyAuthProps {
  onImportComplete?: () => void;
}

export function SpotifyAuth({ onImportComplete }: SpotifyAuthProps) {
  const { isConnected, isLoading, connect, disconnect } = useSpotifyAuth();
  const { error: callbackError, isProcessing, clearError } = useSpotifyCallback();
  const importInProgressRef = useRef(false);

  // Initialize state from sessionStorage synchronously to prevent race conditions
  const [isImporting, setIsImporting] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(SPOTIFY_IMPORTING_KEY) === 'true';
    }
    return false;
  });
  const [importStatus, setImportStatus] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(SPOTIFY_IMPORT_STATUS_KEY);
    }
    return null;
  });
  const [hasImported, setHasImported] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(SPOTIFY_IMPORTED_KEY) === 'true';
    }
    return false;
  });

  // Poll for import status updates (in case import is running in background)
  useEffect(() => {
    if (!isImporting) return;

    const interval = setInterval(() => {
      const status = sessionStorage.getItem(SPOTIFY_IMPORT_STATUS_KEY);
      const importing = sessionStorage.getItem(SPOTIFY_IMPORTING_KEY) === 'true';
      const imported = sessionStorage.getItem(SPOTIFY_IMPORTED_KEY) === 'true';

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
      sessionStorage.setItem(SPOTIFY_IMPORT_STATUS_KEY, status);
    } else {
      sessionStorage.removeItem(SPOTIFY_IMPORT_STATUS_KEY);
    }
  }, []);

  // Import artists from Spotify
  const importArtists = useCallback(async () => {
    // Check both state and sessionStorage to prevent duplicate imports
    const alreadyImported = hasImported || sessionStorage.getItem(SPOTIFY_IMPORTED_KEY) === 'true';
    const alreadyImporting = isImporting || sessionStorage.getItem(SPOTIFY_IMPORTING_KEY) === 'true' || importInProgressRef.current;

    if (alreadyImported || alreadyImporting) return;

    // Mark import as in progress in both state and sessionStorage
    importInProgressRef.current = true;
    setIsImporting(true);
    sessionStorage.setItem(SPOTIFY_IMPORTING_KEY, 'true');
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
        sessionStorage.setItem(SPOTIFY_IMPORTED_KEY, 'true');
        sessionStorage.removeItem(SPOTIFY_IMPORTING_KEY);
        importInProgressRef.current = false;
        return;
      }

      updateImportStatus(`Found ${spotifyArtists.length} artists. Matching with MusicBrainz...`);

      let imported = 0;
      let processed = 0;

      for (const spotifyArtist of spotifyArtists) {
        processed++;
        updateImportStatus(`Matching "${spotifyArtist.name}" (${processed}/${spotifyArtists.length})...`);

        try {
          const mbResults = await searchArtists(spotifyArtist.name, 1);

          if (mbResults.length > 0) {
            const mbArtist = mbResults[0];

            // Add directly to localStorage (works even if component unmounts)
            const wasAdded = addFavoriteToStorage({
              id: mbArtist.id,
              name: mbArtist.name,
              type: mbArtist.type,
              country: mbArtist.country,
              genres: mbArtist.genres,
            });

            if (wasAdded) {
              imported++;
            }
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
      sessionStorage.setItem(SPOTIFY_IMPORTED_KEY, 'true');

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
      sessionStorage.removeItem(SPOTIFY_IMPORTING_KEY);
      importInProgressRef.current = false;
    }
  }, [hasImported, isImporting, onImportComplete, updateImportStatus]);

  // Trigger import after connection
  useEffect(() => {
    if (isConnected && !hasImported && !isImporting) {
      importArtists();
    }
  }, [isConnected, hasImported, isImporting, importArtists]);

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
    sessionStorage.removeItem(SPOTIFY_IMPORTED_KEY);
    sessionStorage.removeItem(SPOTIFY_IMPORTING_KEY);
    sessionStorage.removeItem(SPOTIFY_IMPORT_STATUS_KEY);
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
        {(isImporting || importStatus) && (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            {isImporting && <Loader2 className="size-3 animate-spin" />}
            {importStatus}
          </div>
        )}
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
