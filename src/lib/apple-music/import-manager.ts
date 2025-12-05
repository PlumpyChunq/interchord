/**
 * Apple Music Import Manager
 *
 * Manages the import process in a singleton pattern so it survives
 * component unmounts (e.g., closing settings dropdown).
 *
 * IMPORTANT: This directly writes to localStorage instead of using React callbacks
 * because callbacks become stale when the component unmounts.
 */

import { searchArtists } from '@/lib/musicbrainz/client';
import {
  STORAGE_KEYS,
  STORAGE_EVENTS,
  getStorageItem,
  setStorageItem,
  dispatchStorageEvent,
} from '@/lib/storage';
import type { StoredArtist } from '@/lib/favorites/hooks';

type ImportStatus = {
  isImporting: boolean;
  message: string | null;
  progress: { current: number; total: number } | null;
};

type ImportListener = (status: ImportStatus) => void;

class AppleMusicImportManager {
  private static instance: AppleMusicImportManager;
  private listeners: Set<ImportListener> = new Set();
  private status: ImportStatus = {
    isImporting: false,
    message: null,
    progress: null,
  };
  private importPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): AppleMusicImportManager {
    if (!AppleMusicImportManager.instance) {
      AppleMusicImportManager.instance = new AppleMusicImportManager();
    }
    return AppleMusicImportManager.instance;
  }

  subscribe(listener: ImportListener): () => void {
    this.listeners.add(listener);
    // Immediately send current status
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this.status));
  }

  private setStatus(status: Partial<ImportStatus>) {
    this.status = { ...this.status, ...status };
    this.notify();
  }

  getStatus(): ImportStatus {
    return this.status;
  }

  isImportComplete(): boolean {
    return sessionStorage.getItem('apple-music-imported') === 'true';
  }

  isImporting(): boolean {
    return this.status.isImporting;
  }

  /**
   * Get favorites directly from localStorage
   */
  private getFavorites(): StoredArtist[] {
    return getStorageItem<StoredArtist[]>(STORAGE_KEYS.FAVORITES, []) ?? [];
  }

  /**
   * Add a favorite directly to localStorage (bypasses React state)
   */
  private addFavoriteToStorage(artist: StoredArtist): boolean {
    const favorites = this.getFavorites();

    // Don't add if already exists
    if (favorites.some((f) => f.id === artist.id)) {
      return false;
    }

    const updated = [...favorites, artist];
    if (setStorageItem(STORAGE_KEYS.FAVORITES, updated)) {
      // Dispatch event so React components can update
      dispatchStorageEvent(STORAGE_EVENTS.FAVORITES_UPDATED);
      return true;
    }
    return false;
  }

  /**
   * Start the import process. If already importing, returns the existing promise.
   */
  async startImport(): Promise<void> {
    // Already imported this session
    if (this.isImportComplete()) {
      return;
    }

    // Already importing - return existing promise
    if (this.importPromise) {
      return this.importPromise;
    }

    this.importPromise = this.runImport();
    return this.importPromise;
  }

  private async runImport(): Promise<void> {
    this.setStatus({
      isImporting: true,
      message: 'Fetching your most played music...',
      progress: null,
    });

    try {
      // Dynamically import to avoid SSR issues
      const { getCuratedTopArtists, getTopLibraryArtists } = await import('@/lib/apple-music/client');

      // Try to get artists from heavy rotation + recently played first
      let artistNames = await getCuratedTopArtists(30);

      // Fallback to library if heavy rotation is empty
      if (artistNames.length === 0) {
        this.setStatus({ message: 'No play history found. Fetching library...' });
        const libraryArtists = await getTopLibraryArtists(30);
        artistNames = libraryArtists.map((a) => a.attributes.name);
      }

      if (artistNames.length === 0) {
        this.setStatus({
          isImporting: false,
          message: 'No artists found in your Apple Music.',
          progress: null,
        });
        sessionStorage.setItem('apple-music-imported', 'true');
        this.importPromise = null;
        return;
      }

      this.setStatus({
        message: `Found ${artistNames.length} top artists. Matching with MusicBrainz...`,
        progress: { current: 0, total: artistNames.length },
      });

      let imported = 0;

      for (let i = 0; i < artistNames.length; i++) {
        const artistName = artistNames[i];
        this.setStatus({
          message: `Matching "${artistName}"...`,
          progress: { current: i + 1, total: artistNames.length },
        });

        try {
          const mbResults = await searchArtists(artistName, 1);

          if (mbResults.length > 0) {
            const mbArtist = mbResults[0];

            // Create stored artist object
            const storedArtist: StoredArtist = {
              id: mbArtist.id,
              name: mbArtist.name,
              type: mbArtist.type,
              country: mbArtist.country,
              genres: mbArtist.genres,
            };

            // Add directly to localStorage (survives component unmount!)
            if (this.addFavoriteToStorage(storedArtist)) {
              imported++;
            }
          }

          // Small delay to respect MusicBrainz rate limit
          await new Promise((resolve) => setTimeout(resolve, 1100));
        } catch {
          console.warn(`Failed to match artist: ${artistName}`);
        }
      }

      const message =
        imported > 0
          ? `Added ${imported} new artist${imported !== 1 ? 's' : ''} to favorites!`
          : 'All artists already in favorites';

      this.setStatus({
        isImporting: false,
        message,
        progress: null,
      });

      sessionStorage.setItem('apple-music-imported', 'true');

      // Clear message after a few seconds
      setTimeout(() => {
        this.setStatus({ message: null });
      }, 5000);
    } catch (err) {
      console.error('Error importing artists:', err);
      this.setStatus({
        isImporting: false,
        message: 'Failed to import artists. Try again later.',
        progress: null,
      });
    } finally {
      this.importPromise = null;
    }
  }

  /**
   * Reset the import state (e.g., when disconnecting)
   */
  reset(): void {
    sessionStorage.removeItem('apple-music-imported');
    this.setStatus({
      isImporting: false,
      message: null,
      progress: null,
    });
    this.importPromise = null;
  }
}

export const importManager = AppleMusicImportManager.getInstance();
