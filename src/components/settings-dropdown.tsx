'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Settings, Trash2, Check } from 'lucide-react';
import { SpotifyAuth } from '@/components/spotify-auth';
import { AppleMusicAuth } from '@/components/apple-music-auth';
import { Button } from '@/components/ui/button';
import { FAVORITES_KEY } from '@/lib/favorites/hooks';

// localStorage keys
const GENRE_ORDER_KEY = 'interchord-genre-order';
const PRIMARY_SERVICE_KEY = 'interchord-primary-service';

export type MusicService = 'spotify' | 'apple-music' | null;

// Helper to get the primary music service
export function getPrimaryMusicService(): MusicService {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(PRIMARY_SERVICE_KEY);
  if (stored === 'spotify' || stored === 'apple-music') return stored;
  return null;
}

// Helper to set the primary music service
export function setPrimaryMusicService(service: MusicService): void {
  if (typeof window === 'undefined') return;
  if (service) {
    localStorage.setItem(PRIMARY_SERVICE_KEY, service);
  } else {
    localStorage.removeItem(PRIMARY_SERVICE_KEY);
  }
  window.dispatchEvent(new Event('primary-service-changed'));
}

export function SettingsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [primaryService, setPrimaryServiceState] = useState<MusicService>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load primary service from localStorage on mount
  useEffect(() => {
    setPrimaryServiceState(getPrimaryMusicService());
  }, []);

  const handleSetPrimaryService = useCallback((service: MusicService) => {
    setPrimaryServiceState(service);
    setPrimaryMusicService(service);
  }, []);

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
    try {
      // Clear favorites
      localStorage.removeItem(FAVORITES_KEY);
      // Clear custom genre order
      localStorage.removeItem(GENRE_ORDER_KEY);
      // Clear empty genres
      localStorage.removeItem('interchord-empty-genres');
      // Clear custom genre colors
      localStorage.removeItem('interchord-custom-genre-colors');
      // Clear primary service setting
      localStorage.removeItem(PRIMARY_SERVICE_KEY);
      // Clear all spotify import session flags so it can re-import if needed
      sessionStorage.removeItem('spotify-imported');
      sessionStorage.removeItem('spotify-importing');
      sessionStorage.removeItem('spotify-import-status');
      // Refresh the page to ensure all components update
      window.location.reload();
    } catch {
      // Ignore errors
    }
    setShowConfirm(false);
    setIsOpen(false);
  }, []);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-full hover:bg-gray-100 transition-colors"
        title="Settings"
        aria-label="Settings"
      >
        <Settings className="w-5 h-5 text-gray-600" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="p-3">
            <h3 className="text-sm font-medium text-gray-900 mb-3">
              Connect Music Services
            </h3>
            <div className="space-y-2">
              <SpotifyAuth />
              <AppleMusicAuth />
            </div>
          </div>

          <div className="border-t border-gray-200 p-3">
            <h3 className="text-sm font-medium text-gray-900 mb-3">
              Primary Music Service
            </h3>
            <p className="text-xs text-gray-500 mb-2">
              Used for playback links when both services are connected
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleSetPrimaryService('spotify')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-sm border transition-colors ${
                  primaryService === 'spotify'
                    ? 'bg-green-50 border-green-500 text-green-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {primaryService === 'spotify' && <Check className="w-3.5 h-3.5" />}
                Spotify
              </button>
              <button
                onClick={() => handleSetPrimaryService('apple-music')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-sm border transition-colors ${
                  primaryService === 'apple-music'
                    ? 'bg-pink-50 border-pink-500 text-pink-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {primaryService === 'apple-music' && <Check className="w-3.5 h-3.5" />}
                Apple Music
              </button>
            </div>
          </div>

          <div className="border-t border-gray-200 p-3">
            <h3 className="text-sm font-medium text-gray-900 mb-3">
              Data Management
            </h3>

            {showConfirm ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
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
