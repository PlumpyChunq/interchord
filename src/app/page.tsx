'use client';

import { useState } from 'react';
import { ArtistSearch } from '@/components/artist-search';
import { ArtistDetail } from '@/components/artist-detail';
import type { ArtistNode } from '@/types';

export default function Home() {
  const [selectedArtist, setSelectedArtist] = useState<ArtistNode | null>(null);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Smart Apple Music
          </h1>
          <p className="text-lg text-gray-600">
            Explore artist relationships and discover musical connections
          </p>
        </header>

        {selectedArtist ? (
          <ArtistDetail
            artist={selectedArtist}
            onBack={() => setSelectedArtist(null)}
            onSelectRelated={(artist) => setSelectedArtist(artist)}
          />
        ) : (
          <ArtistSearch onSelectArtist={setSelectedArtist} />
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
