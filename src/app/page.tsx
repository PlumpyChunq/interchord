'use client';

import { useState } from 'react';
import { ArtistSearch } from '@/components/artist-search';
import { ArtistDetail } from '@/components/artist-detail';
import { FavoritesRecentShows } from '@/components/favorites-recent-shows';
import { useFavorites } from '@/lib/favorites';
import type { ArtistNode } from '@/types';

export default function Home() {
  const [selectedArtist, setSelectedArtist] = useState<ArtistNode | null>(null);
  const { favoriteNames, isLoaded } = useFavorites();

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-3">
        <header className="flex items-center mb-4">
          <div className="w-32">
            {selectedArtist && (
              <button
                onClick={() => setSelectedArtist(null)}
                className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
              >
                ← Back to Search
              </button>
            )}
          </div>
          <div className="flex-1 text-center">
            <h1 className="text-3xl font-bold text-gray-900">
              Smart Apple Music
            </h1>
            <p className="text-sm text-gray-600">
              Explore artist relationships and discover musical connections
            </p>
          </div>
          <div className="w-32" />
        </header>

        {selectedArtist ? (
          <ArtistDetail
            artist={selectedArtist}
            onBack={() => setSelectedArtist(null)}
            onSelectRelated={(artist) => setSelectedArtist(artist)}
          />
        ) : (
          <>
            <ArtistSearch onSelectArtist={setSelectedArtist} />
            {/* Show favorites recent shows on home page (after localStorage loads) */}
            {isLoaded && favoriteNames.length > 0 && (
              <div className="max-w-2xl mx-auto">
                <FavoritesRecentShows artistNames={favoriteNames} />
              </div>
            )}
          </>
        )}

        <footer className="mt-16 text-center text-sm text-gray-400">
          <p>
            Powered by{' '}
            <a
              href="https://musicbrainz.org"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-gray-600"
            >
              MusicBrainz
            </a>
          </p>
          <p className="mt-1">Graph-First MVP • Phase 1</p>
        </footer>
      </div>
    </main>
  );
}
