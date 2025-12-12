'use client';

import { useState, useCallback } from 'react';
import { ArtistSearch, type SelectedEntity as SearchSelectedEntity } from '@/components/artist-search';
import { ArtistDetail } from '@/components/artist-detail';
import { FavoritesRecentShows } from '@/components/favorites-recent-shows';
import { SettingsDropdown } from '@/components/settings-dropdown';
import { MusicBrainzStatus } from '@/components/musicbrainz-status';
import { useFavorites } from '@/lib/favorites';
import { useBackgroundEnrichment } from '@/lib/supplement/hooks';
import Image from 'next/image';
import type {
  ArtistNode,
  RecordingNode,
  ReleaseNode,
  LabelNode,
  PlaceNode,
  EventNode,
  WorkNode,
} from '@/types';

// Selected entity can be any type
type SelectedEntity =
  | { type: 'artist'; data: ArtistNode }
  | { type: 'recording'; data: RecordingNode }
  | { type: 'release'; data: ReleaseNode }
  | { type: 'work'; data: WorkNode }
  | { type: 'label'; data: LabelNode }
  | { type: 'place'; data: PlaceNode }
  | { type: 'event'; data: EventNode };

/**
 * Simple entity detail display for non-artist entities
 */
function EntityDetail({
  entity,
  onBack,
}: {
  entity: SelectedEntity;
  onBack: () => void;
}) {
  const mbUrl = `https://musicbrainz.org/${entity.type}/${entity.data.id}`;

  // Format duration from milliseconds
  const formatDuration = (ms: number | undefined) => {
    if (!ms) return null;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const renderDetails = () => {
    switch (entity.type) {
      case 'recording': {
        const recording = entity.data;
        return (
          <>
            {recording.artistCredit && (
              <p className="text-lg text-gray-600">by {recording.artistCredit}</p>
            )}
            {recording.releaseTitle && (
              <p className="text-gray-500">from album: {recording.releaseTitle}</p>
            )}
            {recording.duration && (
              <p className="text-gray-500">Duration: {formatDuration(recording.duration)}</p>
            )}
            {recording.isrc && (
              <p className="text-gray-400 text-sm">ISRC: {recording.isrc}</p>
            )}
          </>
        );
      }
      case 'release': {
        const release = entity.data;
        return (
          <>
            {release.artistCredit && (
              <p className="text-lg text-gray-600">by {release.artistCredit}</p>
            )}
            {release.type && <p className="text-gray-500">Type: {release.type}</p>}
            {release.date && <p className="text-gray-500">Released: {release.date}</p>}
            {release.country && <p className="text-gray-500">Country: {release.country}</p>}
            {release.labelName && <p className="text-gray-500">Label: {release.labelName}</p>}
          </>
        );
      }
      case 'work': {
        const work = entity.data;
        return (
          <>
            {work.artistCredit && (
              <p className="text-lg text-gray-600">
                <span className="font-medium">Written by:</span> {work.artistCredit}
              </p>
            )}
            {work.type && <p className="text-gray-500">Type: {work.type}</p>}
            {work.recordingCount && work.recordingCount > 0 && (
              <p className="text-gray-500">
                {work.recordingCount} recording{work.recordingCount !== 1 ? 's' : ''} of this composition
              </p>
            )}
            {work.iswc && <p className="text-gray-400 text-sm">ISWC: {work.iswc}</p>}
          </>
        );
      }
      case 'label': {
        const label = entity.data;
        return (
          <>
            {label.type && <p className="text-gray-500">Type: {label.type}</p>}
            {label.country && <p className="text-gray-500">Country: {label.country}</p>}
            {label.foundedYear && <p className="text-gray-500">Founded: {label.foundedYear}</p>}
          </>
        );
      }
      case 'place': {
        const place = entity.data;
        return (
          <>
            {place.type && <p className="text-gray-500">Type: {place.type}</p>}
            {place.area && <p className="text-gray-500">Area: {place.area}</p>}
            {place.address && <p className="text-gray-500">Address: {place.address}</p>}
          </>
        );
      }
      case 'event': {
        const event = entity.data;
        return (
          <>
            {event.type && <p className="text-gray-500">Type: {event.type}</p>}
            {event.date && <p className="text-gray-500">Date: {event.date}</p>}
            {event.place && <p className="text-gray-500">Venue: {event.place}</p>}
            {event.area && <p className="text-gray-500">Location: {event.area}</p>}
          </>
        );
      }
      default:
        return null;
    }
  };

  const typeLabels: Record<string, string> = {
    recording: 'Song',
    release: 'Album',
    work: 'Song Composition',
    label: 'Record Label',
    place: 'Place',
    event: 'Event',
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="mb-4">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            {typeLabels[entity.type] || entity.type}
          </span>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-2">{entity.data.name}</h2>

        {entity.data.disambiguation && (
          <p className="text-sm text-gray-400 italic mb-4">{entity.data.disambiguation}</p>
        )}

        <div className="space-y-1 mb-6">{renderDetails()}</div>

        <div className="flex gap-3">
          <a
            href={mbUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
          >
            View on MusicBrainz
          </a>
          <button
            onClick={onBack}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Back to Search
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [selectedArtist, setSelectedArtist] = useState<ArtistNode | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity | null>(null);
  const { favorites, favoriteNames, isLoaded } = useFavorites();

  // Background enrichment: pre-warm supplement cache for favorite groups
  // Only runs on home page when nothing is selected, after 5 second delay
  useBackgroundEnrichment(favorites, isLoaded && !selectedArtist && !selectedEntity);

  // Handle back navigation
  const handleBack = () => {
    setSelectedArtist(null);
    setSelectedEntity(null);
  };

  // Handle non-artist entity selection from search
  const handleSelectEntity = useCallback((entity: SearchSelectedEntity) => {
    // Map the search entity type to page entity type
    setSelectedEntity(entity as SelectedEntity);
  }, []);

  // Is anything selected?
  const hasSelection = selectedArtist || selectedEntity;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className={`mx-auto py-3 ${hasSelection ? 'px-4' : 'container px-4'}`}>
        <header className="flex items-center mb-4">
          <div className="w-48">
            {hasSelection && (
              <button
                onClick={handleBack}
                className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
              >
                ← Back to Search
              </button>
            )}
          </div>
          <div className="flex-1 flex items-center justify-center gap-3">
            <Image
              src="/logo-512.png"
              alt="InterChord Logo"
              width={48}
              height={48}
              className="rounded-lg"
            />
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900">
                InterChord
              </h1>
              <p className="text-sm text-gray-600">
                The Music Web
              </p>
            </div>
          </div>
          <div className="w-48 flex items-center justify-end gap-3">
            <MusicBrainzStatus />
            <SettingsDropdown />
          </div>
        </header>

        {selectedArtist ? (
          <ArtistDetail
            artist={selectedArtist}
            onBack={handleBack}
            onSelectRelated={(artist) => setSelectedArtist(artist)}
          />
        ) : selectedEntity ? (
          <EntityDetail entity={selectedEntity} onBack={handleBack} />
        ) : (
          <>
            {/* Search with autocomplete and favorites */}
            <ArtistSearch
              onSelectArtist={setSelectedArtist}
              onSelectEntity={handleSelectEntity}
            />

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
            {' • '}
            <a
              href="https://music.apple.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-gray-600"
            >
              Apple Music
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
