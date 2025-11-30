/**
 * Core type definitions for Smart Apple Music
 * Artist Relationship Graph MVP
 */

// ============================================================================
// Artist Graph Types (Phase 1 MVP)
// ============================================================================

/**
 * Node in the artist relationship graph
 * Compatible with Cytoscape.js node format
 */
export interface ArtistNode {
  id: string;                    // MusicBrainz MBID
  name: string;
  type: 'person' | 'group';
  disambiguation?: string;       // MusicBrainz disambiguation
  country?: string;
  activeYears?: {
    begin?: string;
    end?: string | null;         // null = still active
  };
  externalIds?: {
    discogs?: string;
    lastfm?: string;
    wikidata?: string;
    spotify?: string;
  };
  imageUrl?: string;
  loaded?: boolean;              // Has this node been expanded?
  founding?: boolean;            // Is this a founding member? (for graph styling)
  instruments?: string[];        // Top instruments/roles (vocals, guitar, drums, etc.)
}

/**
 * Relationship types between artists
 */
export type RelationshipType =
  | 'member_of'        // Person is/was member of band
  | 'founder_of'       // Founded the band/group
  | 'side_project'     // Related side project
  | 'collaboration'    // Featured/collaborated on tracks
  | 'producer'         // Produced for the artist
  | 'influenced_by'    // Musical influence
  | 'same_scene'       // Same musical scene
  | 'same_label'       // Same record label
  | 'touring_member';  // Touring/session musician

/**
 * Edge in the artist relationship graph
 * Compatible with Cytoscape.js edge format
 */
export interface ArtistRelationship {
  id: string;                    // Unique edge ID
  source: string;                // Source artist MBID
  target: string;                // Target artist MBID
  type: RelationshipType;
  attributes?: string[];         // e.g., ["vocals", "guitar"]
  period?: {
    begin?: string;
    end?: string | null;
  };
  direction: 'forward' | 'backward' | 'both';
}

/**
 * Complete artist graph structure
 * Cytoscape.js compatible format
 */
export interface ArtistGraph {
  nodes: Array<{
    data: ArtistNode;
    position?: { x: number; y: number };
  }>;
  edges: Array<{
    data: ArtistRelationship;
  }>;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * MusicBrainz artist search result
 */
export interface MusicBrainzArtist {
  id: string;                    // MBID
  name: string;
  'sort-name': string;
  type?: 'Person' | 'Group' | 'Orchestra' | 'Choir' | 'Character' | 'Other';
  disambiguation?: string;
  country?: string;
  'life-span'?: {
    begin?: string;
    end?: string;
    ended?: boolean;
  };
  tags?: Array<{ name: string; count: number }>;
  relations?: MusicBrainzRelation[];
}

/**
 * MusicBrainz artist relation
 */
export interface MusicBrainzRelation {
  type: string;
  'type-id': string;
  direction: 'forward' | 'backward';
  artist?: MusicBrainzArtist;
  attributes?: string[];
  begin?: string;
  end?: string;
  ended?: boolean;
}

/**
 * MusicBrainz search response
 */
export interface MusicBrainzSearchResponse {
  created: string;
  count: number;
  offset: number;
  artists: MusicBrainzArtist[];
}

// ============================================================================
// Application State Types
// ============================================================================

/**
 * Search state
 */
export interface SearchState {
  query: string;
  results: ArtistNode[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Graph state
 */
export interface GraphState {
  graph: ArtistGraph;
  selectedNode: string | null;
  isLoading: boolean;
  error: string | null;
}

// ============================================================================
// Future Types (Phase 2+)
// ============================================================================

/**
 * User music profile from Apple Music (Future)
 */
export interface UserMusicProfile {
  userId: string;
  library: {
    artists: string[];
    albums: string[];
    playlists: string[];
  };
  recentlyPlayed: string[];
  heavyRotation: string[];
  topGenres: Array<{ genre: string; weight: number }>;
  lastUpdated: string;
}

/**
 * Generated playlist (Future)
 */
export interface GeneratedPlaylist {
  id: string;
  name: string;
  description: string;
  theme: PlaylistTheme;
  tracks: PlaylistTrack[];
  createdAt: string;
  syncedToAppleMusic: boolean;
  appleMusicPlaylistId?: string;
}

export type PlaylistTheme =
  | 'deep_cuts'
  | 'side_projects'
  | 'era_exploration'
  | 'genre_adjacent'
  | 'mood_based'
  | 'collaborator_chain'
  | 'custom';

export interface PlaylistTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  appleMusicId?: string;
  addedReason: string;
}
