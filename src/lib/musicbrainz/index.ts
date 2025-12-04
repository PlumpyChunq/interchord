// Direct API client (rate-limited, use for client-side calls)
export {
  searchArtists,
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

// Data source with fallback (server-side only)
// Use via API routes: /api/musicbrainz/*
export type { DataSource, DataSourceResult } from './data-source';
