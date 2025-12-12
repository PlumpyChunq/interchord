import type { ArtistNode } from '@/types';

// Direct API client (rate-limited, ONLY use as fallback)
export {
  searchArtists as searchArtistsDirect, // Renamed to discourage direct use
  getArtist,
  getArtistLifeSpan,
  getArtistRelationships,
  getArtistReleaseGroups,
  buildArtistGraph,
  getServerStatus,
  forceRecoveryCheck,
} from './client';

export type { MusicBrainzServerStatus } from './client';

// React Query hooks
export {
  useArtistSearch,
  useArtistRelationships,
  useArtistGraph,
} from './hooks';

// Autocomplete hook
export { useAutocomplete } from './use-autocomplete';

// Solr client (server-side only)
export {
  autocompleteArtists,
  searchArtistsSolr,
  testSolrConnection,
} from './solr-client';

// Data source with fallback (server-side only)
// Use via API routes: /api/musicbrainz/*
export type { DataSource, DataSourceResult } from './data-source';

/**
 * Search artists via API route (uses local DB when available)
 * This is the PREFERRED method for client-side code
 * Note: Search results do NOT include genres (for performance)
 * Use getArtistById() to fetch full artist data with genres
 */
export async function searchArtists(query: string, limit: number = 10): Promise<ArtistNode[]> {
  const response = await fetch(
    `/api/musicbrainz/search?q=${encodeURIComponent(query)}&limit=${limit}`
  );

  if (!response.ok) {
    throw new Error(`Search failed: ${response.status}`);
  }

  const data = await response.json();
  return data.artists || [];
}

/**
 * Fetch a single artist by MBID with full data including genres
 * Uses the artist API route which fetches from local DB with genres
 */
export async function getArtistById(mbid: string): Promise<ArtistNode | null> {
  const response = await fetch(`/api/musicbrainz/artist/${encodeURIComponent(mbid)}`);

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`Failed to fetch artist: ${response.status}`);
  }

  const data = await response.json();
  return data.artist || null;
}
