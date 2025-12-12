/**
 * MusicBrainz Solr Search Client
 *
 * Direct access to Solr for fast autocomplete and search operations.
 * Solr is optimized for text search and provides much faster results
 * than PostgreSQL ILIKE queries for autocomplete use cases.
 *
 * Supported collections:
 * - artist: 2.7M artists (persons, groups, orchestras)
 * - recording: 35M recordings (songs, tracks)
 * - release: 3M+ releases (albums, EPs, singles)
 * - release-group: Album groupings (reissues grouped together)
 * - work: 1.5M+ compositions (songs as written works)
 * - label: Record labels
 * - place: Venues, studios, cities
 * - area: Countries, regions, cities
 * - event: Concerts, festivals
 */

import type {
  ArtistNode,
  RecordingNode,
  ReleaseNode,
  ReleaseGroupNode,
  WorkNode,
  LabelNode,
  PlaceNode,
  AreaNode,
  EventNode,
  SearchEntityType,
} from '@/types';

// Solr configuration
const SOLR_URL = process.env.SOLR_URL || 'http://localhost:8983/solr';
const SOLR_TIMEOUT_MS = 3000;

// ============================================================================
// Solr Document Interfaces
// ============================================================================

interface SolrArtistDoc {
  mbid: string;
  name: string;
  sortname?: string;
  type?: string;
  area?: string;
  begin?: string;
  end?: string;
  ended?: boolean;
  comment?: string;
}

interface SolrRecordingDoc {
  mbid: string;
  recording: string;           // Track title
  artist?: string;             // Artist name
  arid?: string;               // Artist MBID
  dur?: number;                // Duration in ms
  comment?: string;
  release?: string;            // Album name
  reid?: string;               // Release MBID
  isrc?: string;
}

interface SolrReleaseDoc {
  mbid: string;
  release: string;             // Album title
  artist?: string;             // Artist name
  arid?: string;               // Artist MBID
  type?: string;               // Album, EP, Single
  date?: string;               // Release date
  country?: string;
  label?: string;              // Record label
  barcode?: string;
  comment?: string;
}

interface SolrReleaseGroupDoc {
  mbid: string;
  releasegroup: string;        // Album title
  artist?: string;             // Artist name
  arid?: string;               // Artist MBID
  type?: string;               // Album, EP, Single
  firstreleasedate?: string;
  comment?: string;
}

interface SolrWorkDoc {
  mbid: string;
  work: string;                // Composition title
  type?: string;               // Song, Opera, etc.
  iswc?: string;
  comment?: string;
  artist?: string;             // Composer/songwriter names
  arid?: string;               // Composer MBID
  recording_count?: number;    // Number of recordings of this work
}

interface SolrLabelDoc {
  mbid: string;
  label: string;               // Label name
  type?: string;
  country?: string;
  begin?: string;              // Founded year
  comment?: string;
}

interface SolrPlaceDoc {
  mbid: string;
  place: string;               // Place name
  type?: string;               // Venue, Studio, etc.
  address?: string;
  area?: string;               // City/region
  comment?: string;
}

interface SolrAreaDoc {
  mbid: string;
  area: string;                // Area name
  type?: string;               // Country, City, etc.
  comment?: string;
}

interface SolrEventDoc {
  mbid: string;
  event: string;               // Event name
  type?: string;               // Concert, Festival
  begin?: string;              // Event date
  place?: string;              // Venue
  area?: string;               // City
  comment?: string;
}

type SolrDoc =
  | SolrArtistDoc
  | SolrRecordingDoc
  | SolrReleaseDoc
  | SolrReleaseGroupDoc
  | SolrWorkDoc
  | SolrLabelDoc
  | SolrPlaceDoc
  | SolrAreaDoc
  | SolrEventDoc;

interface SolrResponse<T = SolrDoc> {
  response: {
    numFound: number;
    start: number;
    docs: T[];
  };
}

// ============================================================================
// Mapping Functions
// ============================================================================

/**
 * Map Solr document to ArtistNode
 */
function mapSolrArtistDoc(doc: SolrArtistDoc): ArtistNode {
  return {
    id: doc.mbid,
    name: doc.name,
    type: doc.type === 'Person' ? 'person' : 'group',
    disambiguation: doc.comment || undefined,
    country: doc.area || undefined,
    activeYears: doc.begin
      ? {
          begin: doc.begin,
          end: doc.ended ? doc.end : null,
        }
      : undefined,
    loaded: false,
  };
}

/**
 * Map Solr document to RecordingNode
 */
function mapSolrRecordingDoc(doc: SolrRecordingDoc): RecordingNode {
  return {
    id: doc.mbid,
    name: doc.recording,
    artistCredit: doc.artist,
    artistId: doc.arid,
    duration: doc.dur,
    disambiguation: doc.comment,
    releaseTitle: doc.release,
    releaseId: doc.reid,
    isrc: doc.isrc,
  };
}

/**
 * Map Solr document to ReleaseNode
 */
function mapSolrReleaseDoc(doc: SolrReleaseDoc): ReleaseNode {
  return {
    id: doc.mbid,
    name: doc.release,
    artistCredit: doc.artist,
    artistId: doc.arid,
    type: doc.type,
    date: doc.date,
    country: doc.country,
    labelName: doc.label,
    barcode: doc.barcode,
    disambiguation: doc.comment,
  };
}

/**
 * Map Solr document to ReleaseGroupNode
 */
function mapSolrReleaseGroupDoc(doc: SolrReleaseGroupDoc): ReleaseGroupNode {
  return {
    id: doc.mbid,
    name: doc.releasegroup,
    artistCredit: doc.artist,
    artistId: doc.arid,
    type: doc.type,
    firstReleaseDate: doc.firstreleasedate,
    disambiguation: doc.comment,
  };
}

/**
 * Map Solr document to WorkNode
 */
function mapSolrWorkDoc(doc: SolrWorkDoc): WorkNode {
  return {
    id: doc.mbid,
    name: doc.work,
    type: doc.type,
    iswc: doc.iswc,
    disambiguation: doc.comment,
    artistCredit: doc.artist,        // Songwriter/composer name
    artistId: doc.arid,              // Songwriter MBID
    recordingCount: doc.recording_count,
  };
}

/**
 * Map Solr document to LabelNode
 */
function mapSolrLabelDoc(doc: SolrLabelDoc): LabelNode {
  return {
    id: doc.mbid,
    name: doc.label,
    type: doc.type,
    country: doc.country,
    foundedYear: doc.begin,
    disambiguation: doc.comment,
  };
}

/**
 * Map Solr document to PlaceNode
 */
function mapSolrPlaceDoc(doc: SolrPlaceDoc): PlaceNode {
  return {
    id: doc.mbid,
    name: doc.place,
    type: doc.type,
    address: doc.address,
    area: doc.area,
    disambiguation: doc.comment,
  };
}

/**
 * Map Solr document to AreaNode
 */
function mapSolrAreaDoc(doc: SolrAreaDoc): AreaNode {
  return {
    id: doc.mbid,
    name: doc.area,
    type: doc.type,
    disambiguation: doc.comment,
  };
}

/**
 * Map Solr document to EventNode
 */
function mapSolrEventDoc(doc: SolrEventDoc): EventNode {
  return {
    id: doc.mbid,
    name: doc.event,
    type: doc.type,
    date: doc.begin,
    place: doc.place,
    area: doc.area,
    disambiguation: doc.comment,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Escape special Solr query characters
 */
function escapeSolrQuery(query: string): string {
  // Escape special characters: + - && || ! ( ) { } [ ] ^ " ~ * ? : \ /
  return query.replace(/([+\-&|!(){}[\]^"~*?:\\/])/g, '\\$1');
}

/**
 * Get the primary name field for each entity type
 */
function getNameField(entityType: SearchEntityType): string {
  switch (entityType) {
    case 'artist':
      return 'name';
    case 'recording':
      return 'recording';
    case 'release':
      return 'release';
    case 'release-group':
      return 'releasegroup';
    case 'work':
      return 'work';
    case 'label':
      return 'label';
    case 'place':
      return 'place';
    case 'area':
      return 'area';
    case 'event':
      return 'event';
    default:
      return 'name';
  }
}

/**
 * Get the Solr collection name for each entity type
 */
function getCollectionName(entityType: SearchEntityType): string {
  // Collection names match entity types
  return entityType;
}

/**
 * Get the fields to return for each entity type
 */
function getReturnFields(entityType: SearchEntityType): string {
  switch (entityType) {
    case 'artist':
      return 'mbid,name,sortname,type,area,begin,end,ended,comment';
    case 'recording':
      return 'mbid,recording,artist,arid,dur,comment,release,reid,isrc';
    case 'release':
      return 'mbid,release,artist,arid,type,date,country,label,barcode,comment';
    case 'release-group':
      return 'mbid,releasegroup,artist,arid,type,firstreleasedate,comment';
    case 'work':
      return 'mbid,work,type,iswc,comment,artist,arid,recording_count';
    case 'label':
      return 'mbid,label,type,country,begin,comment';
    case 'place':
      return 'mbid,place,type,address,area,comment';
    case 'area':
      return 'mbid,area,type,comment';
    case 'event':
      return 'mbid,event,type,begin,place,area,comment';
    default:
      return 'mbid,name,comment';
  }
}

/**
 * Search artists using Solr for autocomplete
 *
 * Uses prefix matching on the name field for fast autocomplete.
 * Falls back to phrase matching for multi-word queries.
 *
 * @param query - Search query (partial artist name)
 * @param limit - Maximum results to return (default: 10)
 * @returns Array of matching artists
 */
export async function autocompleteArtists(
  query: string,
  limit: number = 10
): Promise<ArtistNode[]> {
  if (!query || query.length < 2) {
    return [];
  }

  const escapedQuery = escapeSolrQuery(query);

  // Build Solr query:
  // 1. Exact name match (boosted heavily)
  // 2. Name starts with query (prefix match)
  // 3. Name contains query words
  const solrQuery = [
    `name:"${escapedQuery}"^100`,       // Exact match, highest boost
    `name:${escapedQuery}*^50`,          // Prefix match
    `name:*${escapedQuery}*^10`,         // Contains match
    `sortname:${escapedQuery}*^5`,       // Sort name prefix
  ].join(' OR ');

  const params = new URLSearchParams({
    q: solrQuery,
    wt: 'json',
    rows: String(limit),
    fl: 'mbid,name,sortname,type,area,begin,end,ended,comment',
    // Sort by score (relevance) then alphabetically
    sort: 'score desc,name asc',
  });

  const url = `${SOLR_URL}/artist/select?${params}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SOLR_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Solr error: ${response.status} ${response.statusText}`);
    }

    const data: SolrResponse<SolrArtistDoc> = await response.json();
    return data.response.docs.map(mapSolrArtistDoc);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('[Solr] Autocomplete request timed out');
    } else {
      console.error('[Solr] Autocomplete error:', error);
    }
    throw error;
  }
}

/**
 * Full-text search artists using Solr
 *
 * More comprehensive search than autocomplete, includes fuzzy matching.
 *
 * @param query - Search query
 * @param limit - Maximum results (default: 25)
 * @param offset - Pagination offset (default: 0)
 * @returns Array of matching artists
 */
export async function searchArtistsSolr(
  query: string,
  limit: number = 25,
  offset: number = 0
): Promise<{ artists: ArtistNode[]; total: number }> {
  if (!query || query.length < 2) {
    return { artists: [], total: 0 };
  }

  const escapedQuery = escapeSolrQuery(query);

  // Full search with fuzzy matching
  const solrQuery = [
    `name:"${escapedQuery}"^100`,       // Exact match
    `name:${escapedQuery}*^50`,          // Prefix match
    `name:${escapedQuery}~^20`,          // Fuzzy match
    `name:*${escapedQuery}*^10`,         // Contains
    `sortname:${escapedQuery}*^5`,       // Sort name
  ].join(' OR ');

  const params = new URLSearchParams({
    q: solrQuery,
    wt: 'json',
    rows: String(limit),
    start: String(offset),
    fl: 'mbid,name,sortname,type,area,begin,end,ended,comment',
    sort: 'score desc,name asc',
  });

  const url = `${SOLR_URL}/artist/select?${params}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SOLR_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Solr error: ${response.status} ${response.statusText}`);
    }

    const data: SolrResponse<SolrArtistDoc> = await response.json();
    return {
      artists: data.response.docs.map(mapSolrArtistDoc),
      total: data.response.numFound,
    };
  } catch (error) {
    console.error('[Solr] Search error:', error);
    throw error;
  }
}

/**
 * Test Solr connectivity
 */
export async function testSolrConnection(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${SOLR_URL}/artist/admin/ping?wt=json`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

// ============================================================================
// Generic Multi-Entity Search Functions
// ============================================================================

/**
 * Result type for generic entity search
 */
export type SearchResult<T extends SearchEntityType> = T extends 'artist'
  ? ArtistNode
  : T extends 'recording'
    ? RecordingNode
    : T extends 'release'
      ? ReleaseNode
      : T extends 'release-group'
        ? ReleaseGroupNode
        : T extends 'work'
          ? WorkNode
          : T extends 'label'
            ? LabelNode
            : T extends 'place'
              ? PlaceNode
              : T extends 'area'
                ? AreaNode
                : T extends 'event'
                  ? EventNode
                  : never;

/**
 * Map a Solr document to the appropriate node type
 */
function mapSolrDocToEntity<T extends SearchEntityType>(
  entityType: T,
  doc: SolrDoc
): SearchResult<T> {
  switch (entityType) {
    case 'artist':
      return mapSolrArtistDoc(doc as SolrArtistDoc) as SearchResult<T>;
    case 'recording':
      return mapSolrRecordingDoc(doc as SolrRecordingDoc) as SearchResult<T>;
    case 'release':
      return mapSolrReleaseDoc(doc as SolrReleaseDoc) as SearchResult<T>;
    case 'release-group':
      return mapSolrReleaseGroupDoc(doc as SolrReleaseGroupDoc) as SearchResult<T>;
    case 'work':
      return mapSolrWorkDoc(doc as SolrWorkDoc) as SearchResult<T>;
    case 'label':
      return mapSolrLabelDoc(doc as SolrLabelDoc) as SearchResult<T>;
    case 'place':
      return mapSolrPlaceDoc(doc as SolrPlaceDoc) as SearchResult<T>;
    case 'area':
      return mapSolrAreaDoc(doc as SolrAreaDoc) as SearchResult<T>;
    case 'event':
      return mapSolrEventDoc(doc as SolrEventDoc) as SearchResult<T>;
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}

/**
 * Generic autocomplete search for any entity type
 *
 * @param entityType - The type of entity to search for
 * @param query - Search query (partial name)
 * @param limit - Maximum results to return (default: 10)
 * @returns Array of matching entities
 */
export async function autocompleteEntities<T extends SearchEntityType>(
  entityType: T,
  query: string,
  limit: number = 10
): Promise<SearchResult<T>[]> {
  if (!query || query.length < 2) {
    return [];
  }

  const escapedQuery = escapeSolrQuery(query);
  const nameField = getNameField(entityType);
  const collection = getCollectionName(entityType);
  const fields = getReturnFields(entityType);

  // Build Solr query with boosted matching
  const solrQuery = [
    `${nameField}:"${escapedQuery}"^100`, // Exact match
    `${nameField}:${escapedQuery}*^50`, // Prefix match
    `${nameField}:*${escapedQuery}*^10`, // Contains match
  ].join(' OR ');

  // Note: Only artist collection has sortable name field
  // Other collections use text fields that can't be sorted directly
  // So we just sort by score (relevance) for non-artist searches
  const sortClause = entityType === 'artist' ? 'score desc,name asc' : 'score desc';

  const params = new URLSearchParams({
    q: solrQuery,
    wt: 'json',
    rows: String(limit),
    fl: fields,
    sort: sortClause,
  });

  const url = `${SOLR_URL}/${collection}/select?${params}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SOLR_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Solr error: ${response.status} ${response.statusText}`);
    }

    const data: SolrResponse = await response.json();
    return data.response.docs.map((doc) => mapSolrDocToEntity(entityType, doc));
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`[Solr] Autocomplete ${entityType} request timed out`);
    } else {
      console.error(`[Solr] Autocomplete ${entityType} error:`, error);
    }
    throw error;
  }
}

/**
 * Generic full-text search for any entity type
 *
 * @param entityType - The type of entity to search for
 * @param query - Search query
 * @param limit - Maximum results (default: 25)
 * @param offset - Pagination offset (default: 0)
 * @returns Array of matching entities and total count
 */
export async function searchEntities<T extends SearchEntityType>(
  entityType: T,
  query: string,
  limit: number = 25,
  offset: number = 0
): Promise<{ results: SearchResult<T>[]; total: number }> {
  if (!query || query.length < 2) {
    return { results: [], total: 0 };
  }

  const escapedQuery = escapeSolrQuery(query);
  const nameField = getNameField(entityType);
  const collection = getCollectionName(entityType);
  const fields = getReturnFields(entityType);

  // Full search with fuzzy matching
  const solrQuery = [
    `${nameField}:"${escapedQuery}"^100`, // Exact match
    `${nameField}:${escapedQuery}*^50`, // Prefix match
    `${nameField}:${escapedQuery}~^20`, // Fuzzy match
    `${nameField}:*${escapedQuery}*^10`, // Contains match
  ].join(' OR ');

  // Note: Only artist collection has sortable name field
  const sortClause = entityType === 'artist' ? 'score desc,name asc' : 'score desc';

  const params = new URLSearchParams({
    q: solrQuery,
    wt: 'json',
    rows: String(limit),
    start: String(offset),
    fl: fields,
    sort: sortClause,
  });

  const url = `${SOLR_URL}/${collection}/select?${params}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SOLR_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Solr error: ${response.status} ${response.statusText}`);
    }

    const data: SolrResponse = await response.json();
    return {
      results: data.response.docs.map((doc) => mapSolrDocToEntity(entityType, doc)),
      total: data.response.numFound,
    };
  } catch (error) {
    console.error(`[Solr] Search ${entityType} error:`, error);
    throw error;
  }
}

// ============================================================================
// Convenience Functions for Each Entity Type
// ============================================================================

export const autocompleteRecordings = (query: string, limit?: number) =>
  autocompleteEntities('recording', query, limit);

export const autocompleteReleases = (query: string, limit?: number) =>
  autocompleteEntities('release', query, limit);

export const autocompleteReleaseGroups = (query: string, limit?: number) =>
  autocompleteEntities('release-group', query, limit);

export const autocompleteWorks = (query: string, limit?: number) =>
  autocompleteEntities('work', query, limit);

export const autocompleteLabels = (query: string, limit?: number) =>
  autocompleteEntities('label', query, limit);

export const autocompletePlaces = (query: string, limit?: number) =>
  autocompleteEntities('place', query, limit);

export const autocompleteAreas = (query: string, limit?: number) =>
  autocompleteEntities('area', query, limit);

export const autocompleteEvents = (query: string, limit?: number) =>
  autocompleteEntities('event', query, limit);
