/**
 * Apple Music Import Manager
 *
 * Manages the import process in a singleton pattern so it survives
 * component unmounts (e.g., closing settings dropdown).
 *
 * IMPORTANT: This directly writes to localStorage instead of using React callbacks
 * because callbacks become stale when the component unmounts.
 */

import { searchArtists, getArtistById } from '@/lib/musicbrainz';
import {
  STORAGE_KEYS,
  STORAGE_EVENTS,
  getStorageItem,
  setStorageItem,
  dispatchStorageEvent,
} from '@/lib/storage';
import type { StoredArtist } from '@/lib/favorites/hooks';

// Cache key for persistent import tracking
const APPLE_MUSIC_IMPORT_KEY = 'apple-music-last-import';
// Full re-sync after 30 days, but background diff checks happen more often
const FULL_SYNC_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
// Background check interval - check for new artists every 4 hours
const BACKGROUND_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

type ImportStatus = {
  isImporting: boolean;
  message: string | null;
  progress: { current: number; total: number } | null;
};

type ImportCache = {
  timestamp: number;
  artistCount: number;
  lastBackgroundCheck?: number;
  importedArtistNames: string[]; // Track what we've already imported
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

  /**
   * Check if initial import was completed (not expired)
   */
  isImportComplete(): boolean {
    try {
      const cached = localStorage.getItem(APPLE_MUSIC_IMPORT_KEY);
      if (!cached) return false;

      const data: ImportCache = JSON.parse(cached);
      const age = Date.now() - data.timestamp;

      // Full import cache is still valid
      return age < FULL_SYNC_DURATION_MS;
    } catch {
      return false;
    }
  }

  /**
   * Check if we should do a background diff check
   */
  shouldBackgroundCheck(): boolean {
    try {
      const cached = localStorage.getItem(APPLE_MUSIC_IMPORT_KEY);
      if (!cached) return false;

      const data: ImportCache = JSON.parse(cached);
      const lastCheck = data.lastBackgroundCheck || data.timestamp;
      const timeSinceCheck = Date.now() - lastCheck;

      return timeSinceCheck > BACKGROUND_CHECK_INTERVAL_MS;
    } catch {
      return false;
    }
  }

  /**
   * Get the list of already imported artist names
   */
  private getImportedArtistNames(): string[] {
    try {
      const cached = localStorage.getItem(APPLE_MUSIC_IMPORT_KEY);
      if (!cached) return [];

      const data: ImportCache = JSON.parse(cached);
      return data.importedArtistNames || [];
    } catch {
      return [];
    }
  }

  /**
   * Get info about the last import
   */
  getLastImportInfo(): { date: Date; artistCount: number } | null {
    try {
      const cached = localStorage.getItem(APPLE_MUSIC_IMPORT_KEY);
      if (!cached) return null;

      const data: ImportCache = JSON.parse(cached);
      return {
        date: new Date(data.timestamp),
        artistCount: data.artistCount,
      };
    } catch {
      return null;
    }
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
        this.saveImportCache(0, []);
        this.importPromise = null;
        return;
      }

      this.setStatus({
        message: `Found ${artistNames.length} top artists. Matching with MusicBrainz...`,
        progress: { current: 0, total: artistNames.length },
      });

      let imported = 0;
      const importedNames: string[] = [];

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

            // Fetch full artist data with genres from the artist API
            // Search results don't include genres for performance, but we need them for import
            let genres = mbArtist.genres;
            try {
              const fullArtist = await getArtistById(mbArtist.id);
              if (fullArtist?.genres) {
                genres = fullArtist.genres;
              }
            } catch (error) {
              console.warn(`Failed to fetch genres for ${artistName}:`, error);
              // Continue with search result (genres will be undefined)
            }

            // Create stored artist object
            const storedArtist: StoredArtist = {
              id: mbArtist.id,
              name: mbArtist.name,
              type: mbArtist.type,
              country: mbArtist.country,
              genres,
            };

            // Add directly to localStorage (survives component unmount!)
            if (this.addFavoriteToStorage(storedArtist)) {
              imported++;
            }
            // Track all artist names we processed (for diff checking later)
            importedNames.push(artistName);
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

      // Save to persistent cache with timestamp and artist names
      this.saveImportCache(imported, importedNames);

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
   * Save import completion to persistent cache
   */
  private saveImportCache(artistCount: number, artistNames: string[]): void {
    const existingNames = this.getImportedArtistNames();
    const allNames = [...new Set([...existingNames, ...artistNames])];

    const cache: ImportCache = {
      timestamp: Date.now(),
      artistCount,
      importedArtistNames: allNames,
    };
    localStorage.setItem(APPLE_MUSIC_IMPORT_KEY, JSON.stringify(cache));
  }

  /**
   * Update just the background check timestamp
   */
  private updateBackgroundCheckTime(): void {
    try {
      const cached = localStorage.getItem(APPLE_MUSIC_IMPORT_KEY);
      if (!cached) return;

      const data: ImportCache = JSON.parse(cached);
      data.lastBackgroundCheck = Date.now();
      localStorage.setItem(APPLE_MUSIC_IMPORT_KEY, JSON.stringify(data));
    } catch {
      // Ignore errors
    }
  }

  /**
   * Background diff sync - quietly check for new artists and import only those
   */
  async backgroundSync(): Promise<void> {
    if (!this.shouldBackgroundCheck() || this.status.isImporting) {
      return;
    }

    try {
      const { getCuratedTopArtists } = await import('@/lib/apple-music/client');
      const currentArtists = await getCuratedTopArtists(30);

      if (currentArtists.length === 0) {
        this.updateBackgroundCheckTime();
        return;
      }

      // Find new artists we haven't imported yet
      const alreadyImported = new Set(
        this.getImportedArtistNames().map((n) => n.toLowerCase())
      );
      const newArtists = currentArtists.filter(
        (name) => !alreadyImported.has(name.toLowerCase())
      );

      if (newArtists.length === 0) {
        // No new artists - just update check time
        this.updateBackgroundCheckTime();
        return;
      }

      // Import only the new artists (quietly, without blocking UI)
      console.log(`Apple Music: Found ${newArtists.length} new artists, syncing...`);

      let imported = 0;
      const importedNames: string[] = [];

      for (const artistName of newArtists) {
        try {
          const mbResults = await searchArtists(artistName, 1);

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
              // Continue with search result (genres will be undefined)
            }

            const storedArtist: StoredArtist = {
              id: mbArtist.id,
              name: mbArtist.name,
              type: mbArtist.type,
              country: mbArtist.country,
              genres,
            };

            if (this.addFavoriteToStorage(storedArtist)) {
              imported++;
              importedNames.push(artistName);
            }
          }

          // Rate limit
          await new Promise((resolve) => setTimeout(resolve, 1100));
        } catch {
          console.warn(`Background sync: Failed to match ${artistName}`);
        }
      }

      // Update cache with new artist names
      if (importedNames.length > 0) {
        const existingNames = this.getImportedArtistNames();
        const allNames = [...new Set([...existingNames, ...importedNames])];

        const cached = localStorage.getItem(APPLE_MUSIC_IMPORT_KEY);
        if (cached) {
          const data: ImportCache = JSON.parse(cached);
          data.importedArtistNames = allNames;
          data.lastBackgroundCheck = Date.now();
          data.artistCount += imported;
          localStorage.setItem(APPLE_MUSIC_IMPORT_KEY, JSON.stringify(data));
        }

        // Show subtle notification
        this.setStatus({
          isImporting: false,
          message: `Added ${imported} new artist${imported !== 1 ? 's' : ''} from Apple Music`,
          progress: null,
        });

        // Clear after a few seconds
        setTimeout(() => {
          this.setStatus({ message: null });
        }, 5000);
      } else {
        this.updateBackgroundCheckTime();
      }
    } catch (err) {
      console.error('Background sync error:', err);
      this.updateBackgroundCheckTime();
    }
  }

  /**
   * Reset the import state (e.g., when user clicks Re-import or disconnects)
   */
  reset(): void {
    localStorage.removeItem(APPLE_MUSIC_IMPORT_KEY);
    this.setStatus({
      isImporting: false,
      message: null,
      progress: null,
    });
    this.importPromise = null;
  }
}

export const importManager = AppleMusicImportManager.getInstance();
