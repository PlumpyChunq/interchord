/**
 * Core type definitions for InterChord
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
    appleMusic?: string;         // Apple Music artist ID
  };
  imageUrl?: string;
  albums?: AppleMusicAlbumInfo[];  // Top albums from Apple Music
  loaded?: boolean;              // Has this node been expanded?
  founding?: boolean;            // Is this a founding member? (for graph styling)
  instruments?: string[];        // Top instruments/roles (vocals, guitar, drums, etc.)
  genres?: string[];             // Top MusicBrainz tags mapped to genre categories
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
// Timeline Types
// ============================================================================

/**
 * Types of events that can appear on the timeline
 */
export type TimelineEventType =
  | 'album'          // Major album release
  | 'concert'        // Concert/show
  | 'birth'          // Person was born
  | 'formation'      // Band/group formed
  | 'disbanded'      // Band/group disbanded
  | 'member_join'    // Member joined the group
  | 'member_leave'   // Member left the group
  | 'member_death';  // Member passed away

/**
 * A single event on the artist timeline
 */
export interface TimelineEvent {
  id: string;
  date: Date;
  year: number;
  type: TimelineEventType;
  title: string;
  subtitle?: string;           // Additional context (e.g., venue for concerts)
  externalUrl?: string;        // Link to setlist.fm, MusicBrainz, etc.
  relatedArtistIds?: string[]; // MBIDs of related artists (for graph highlighting)
  artistName?: string;         // Name of the artist this event belongs to
}

/**
 * MusicBrainz release group (album/EP/single)
 */
export interface MusicBrainzReleaseGroup {
  id: string;
  title: string;
  'primary-type'?: string;        // Album, EP, Single, etc.
  'secondary-types'?: string[];   // Compilation, Live, Remix, etc.
  'first-release-date'?: string;  // YYYY or YYYY-MM or YYYY-MM-DD
  disambiguation?: string;
}

/**
 * MusicBrainz artist response with release groups
 */
export interface MusicBrainzArtistWithReleases extends MusicBrainzArtist {
  'release-groups'?: MusicBrainzReleaseGroup[];
}

// ============================================================================
// Search Entity Types (Multi-Entity Search)
// ============================================================================

/**
 * Search entity types supported by Solr
 */
export type SearchEntityType =
  | 'artist'
  | 'recording'
  | 'release'
  | 'release-group'
  | 'work'
  | 'label'
  | 'place'
  | 'area'
  | 'event';

/**
 * Recording (song/track) search result
 */
export interface RecordingNode {
  id: string;                    // MusicBrainz MBID
  name: string;                  // Track title
  artistCredit?: string;         // Artist name(s)
  artistId?: string;             // Primary artist MBID
  duration?: number;             // Duration in milliseconds
  disambiguation?: string;
  releaseTitle?: string;         // Album name
  releaseId?: string;            // Album MBID
  isrc?: string;                 // International Standard Recording Code
}

/**
 * Release (album/EP/single) search result
 */
export interface ReleaseNode {
  id: string;                    // MusicBrainz MBID
  name: string;                  // Album title
  artistCredit?: string;         // Artist name(s)
  artistId?: string;             // Primary artist MBID
  type?: string;                 // Album, EP, Single, etc.
  date?: string;                 // Release date
  country?: string;              // Release country
  labelName?: string;            // Record label
  barcode?: string;
  disambiguation?: string;
}

/**
 * Release Group (album grouping) search result
 */
export interface ReleaseGroupNode {
  id: string;                    // MusicBrainz MBID
  name: string;                  // Album title
  artistCredit?: string;         // Artist name(s)
  artistId?: string;             // Primary artist MBID
  type?: string;                 // Album, EP, Single, etc.
  firstReleaseDate?: string;     // Earliest release date
  disambiguation?: string;
}

/**
 * Work (composition) search result
 */
export interface WorkNode {
  id: string;                    // MusicBrainz MBID
  name: string;                  // Composition title
  type?: string;                 // Song, Opera, Symphony, etc.
  iswc?: string;                 // International Standard Musical Work Code
  disambiguation?: string;
  artistCredit?: string;         // Songwriter/composer name(s)
  artistId?: string;             // Primary songwriter MBID
  recordingCount?: number;       // Number of recordings of this work
}

/**
 * Label (record label) search result
 */
export interface LabelNode {
  id: string;                    // MusicBrainz MBID
  name: string;                  // Label name
  type?: string;                 // Major, Indie, etc.
  country?: string;              // Country of origin
  foundedYear?: string;          // Year founded
  disambiguation?: string;
}

/**
 * Place (venue/studio) search result
 */
export interface PlaceNode {
  id: string;                    // MusicBrainz MBID
  name: string;                  // Place name
  type?: string;                 // Venue, Studio, Stadium, etc.
  address?: string;
  area?: string;                 // City/region
  country?: string;
  disambiguation?: string;
}

/**
 * Area (geographic region) search result
 */
export interface AreaNode {
  id: string;                    // MusicBrainz MBID
  name: string;                  // Area name
  type?: string;                 // Country, City, Region, etc.
  parentArea?: string;           // Parent region
  disambiguation?: string;
}

/**
 * Event (concert/festival) search result
 */
export interface EventNode {
  id: string;                    // MusicBrainz MBID
  name: string;                  // Event name
  type?: string;                 // Concert, Festival, etc.
  date?: string;                 // Event date
  place?: string;                // Venue name
  area?: string;                 // City/region
  disambiguation?: string;
}

/**
 * Union type for all search results
 */
export type SearchResultNode =
  | ArtistNode
  | RecordingNode
  | ReleaseNode
  | ReleaseGroupNode
  | WorkNode
  | LabelNode
  | PlaceNode
  | AreaNode
  | EventNode;

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

// ============================================================================
// Apple Music Types
// ============================================================================

/**
 * Simplified album info for display in artist nodes
 */
export interface AppleMusicAlbumInfo {
  id: string;
  name: string;
  artistName: string;
  artworkUrl?: string;           // Pre-formatted URL (not template)
  releaseDate?: string;
  trackCount?: number;
}
