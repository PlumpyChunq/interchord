'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Settings, Trash2, Check, Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';
import { SpotifyAuth } from '@/components/spotify-auth';
import { AppleMusicAuth } from '@/components/apple-music-auth';
import { Button } from '@/components/ui/button';
import {
  STORAGE_KEYS,
  removeStorageItem,
  isClient,
} from '@/lib/storage';
import {
  type MusicService,
  getPrimaryMusicService,
  setPrimaryMusicService,
  getUseNativeApp,
  setUseNativeApp,
} from '@/lib/streaming';

export function SettingsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Initialize state directly from localStorage (runs once on mount)
  const [primaryService, setPrimaryServiceState] = useState<MusicService>(() => getPrimaryMusicService());
  const [useNativeApp, setUseNativeAppState] = useState<boolean>(() => getUseNativeApp());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();

  // Avoid hydration mismatch for theme
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSetPrimaryService = useCallback((service: MusicService) => {
    setPrimaryServiceState(service);
    setPrimaryMusicService(service);
  }, []);

  const handleToggleNativeApp = useCallback(() => {
    const newValue = !useNativeApp;
    setUseNativeAppState(newValue);
    setUseNativeApp(newValue);
  }, [useNativeApp]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowConfirm(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleClearFavorites = useCallback(() => {
    if (!isClient()) return;

    // Clear localStorage items for favorites and related preferences
    removeStorageItem(STORAGE_KEYS.FAVORITES);
    removeStorageItem(STORAGE_KEYS.GENRE_ORDER);
    removeStorageItem(STORAGE_KEYS.EMPTY_GENRES);
    removeStorageItem(STORAGE_KEYS.CUSTOM_GENRE_COLORS);
    removeStorageItem(STORAGE_KEYS.PRIMARY_SERVICE);

    // NOTE: Do NOT clear SPOTIFY_IMPORTED or SPOTIFY_IMPORTING session flags!
    // If we clear those, SpotifyAuth will automatically re-import favorites
    // when the page reloads (if Spotify is still connected).
    // Those flags should only be cleared when disconnecting Spotify.

    // Refresh the page to ensure all components update
    window.location.reload();

    setShowConfirm(false);
    setIsOpen(false);
  }, []);

  return (
    <div ref={dropdownRef} className="relative">
      {/* Always render SpotifyAuth to handle OAuth callbacks and run imports
          even when dropdown is closed. Hide it visually when dropdown is closed. */}
      <div className={isOpen ? 'hidden' : 'hidden'}>
        <SpotifyAuth />
      </div>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        title="Settings"
        aria-label="Settings"
      >
        <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-[1200]">
          {/* Appearance Section */}
          <div className="p-3">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
              Appearance
            </h3>
            <div className="flex gap-1">
              <button
                onClick={() => setTheme('light')}
                disabled={!mounted}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-sm border transition-colors ${
                  mounted && theme === 'light'
                    ? 'bg-amber-50 border-amber-500 text-amber-700 dark:bg-amber-900/30 dark:border-amber-500 dark:text-amber-400'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                } ${!mounted ? 'opacity-50 cursor-wait' : ''}`}
                title="Light mode"
              >
                <Sun className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTheme('dark')}
                disabled={!mounted}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-sm border transition-colors ${
                  mounted && theme === 'dark'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-500 dark:text-indigo-400'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                } ${!mounted ? 'opacity-50 cursor-wait' : ''}`}
                title="Dark mode"
              >
                <Moon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTheme('system')}
                disabled={!mounted}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-sm border transition-colors ${
                  mounted && theme === 'system'
                    ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:border-blue-500 dark:text-blue-400'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                } ${!mounted ? 'opacity-50 cursor-wait' : ''}`}
                title="System preference"
              >
                <Monitor className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 p-3">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
              Connect Music Services
            </h3>
            <div className="space-y-2">
              <SpotifyAuth />
              <AppleMusicAuth />
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 p-3">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
              Primary Music Service
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Used for playback links when both services are connected
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleSetPrimaryService('spotify')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-sm border transition-colors ${
                  primaryService === 'spotify'
                    ? 'bg-green-50 border-green-500 text-green-700 dark:bg-green-900/30 dark:border-green-500 dark:text-green-400'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {primaryService === 'spotify' && <Check className="w-3.5 h-3.5" />}
                Spotify
              </button>
              <button
                onClick={() => handleSetPrimaryService('apple-music')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-sm border transition-colors ${
                  primaryService === 'apple-music'
                    ? 'bg-pink-50 border-pink-500 text-pink-700 dark:bg-pink-900/30 dark:border-pink-500 dark:text-pink-400'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {primaryService === 'apple-music' && <Check className="w-3.5 h-3.5" />}
                Apple Music
              </button>
            </div>

            {/* Native App Toggle */}
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Open in native app</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Opens links in Apple Music or Spotify app instead of browser
                  </p>
                </div>
                <button
                  onClick={handleToggleNativeApp}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    useNativeApp ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                  role="switch"
                  aria-checked={useNativeApp}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      useNativeApp ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </label>
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 p-3">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
              Data Management
            </h3>

            {showConfirm ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Are you sure you want to clear all favorites? This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleClearFavorites}
                    className="flex-1"
                  >
                    Yes, Clear All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowConfirm(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConfirm(true)}
                className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All Favorites
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
