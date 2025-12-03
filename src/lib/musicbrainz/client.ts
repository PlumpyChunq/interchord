/**
 * MusicBrainz API Client
 *
 * Supports both the public MusicBrainz API and local mirror servers.
 *
 * Configuration:
 *   - Set NEXT_PUBLIC_MUSICBRAINZ_API to use a local server (e.g., http://stonefrog-db01.stonefrog.com:5000/ws/2)
 *   - If not set, defaults to public API with rate limiting
 *
 * Rate Limiting:
 *   - Public API: Strict 1 request/second limit (enforced via queue)
 *   - Local server: No rate limiting (unlimited requests)
 */

import type {
  MusicBrainzArtist,
  MusicBrainzArtistWithReleases,
  MusicBrainzReleaseGroup,
  MusicBrainzSearchResponse,
  ArtistNode,
  ArtistRelationship,
  ArtistGraph,
} from '@/types';
import { normalizeAlbumTitle } from '@/lib/utils/album';

// Server configuration
const LOCAL_MUSICBRAINZ_API = process.env.NEXT_PUBLIC_MUSICBRAINZ_API;
const PUBLIC_MUSICBRAINZ_API = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'InterChord/0.1.0 (https://github.com/jstone/interchord)';
const RATE_LIMIT_MS = 1100; // 1.1 seconds between requests (safety margin)

// Track which server we're currently using (can change on fallback)
let currentServer = LOCAL_MUSICBRAINZ_API || PUBLIC_MUSICBRAINZ_API;
let usingLocalServer = !!LOCAL_MUSICBRAINZ_API;
let localServerFailed = false;

// Log which server is being used (only in development)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log(`[MusicBrainz] Primary server: ${currentServer}`);
  if (LOCAL_MUSICBRAINZ_API) {
    console.log(`[MusicBrainz] Fallback enabled: ${PUBLIC_MUSICBRAINZ_API}`);
  }
}

// Request queue for rate limiting
let lastRequestTime = 0;
const requestQueue: Array<() => Promise<void>> = [];
let isProcessingQueue = false;

/**
 * Process the request queue respecting rate limits
 */
async function processQueue(): Promise<void> {
  if (isProcessingQueue || requestQueue.length === 0) return;

  isProcessingQueue = true;

  while (requestQueue.length > 0) {
    // Skip rate limiting for local servers (no 1 req/sec restriction)
    if (!usingLocalServer) {
      const now = Date.now();
      const timeSinceLastRequest = now - lastRequestTime;

      if (timeSinceLastRequest < RATE_LIMIT_MS) {
        await sleep(RATE_LIMIT_MS - timeSinceLastRequest);
      }
    }

    const request = requestQueue.shift();
    if (request) {
      lastRequestTime = Date.now();
      await request();
    }
  }

  isProcessingQueue = false;
}

/**
 * Queue a request and return a promise that resolves with the result
 */
function queueRequest<T>(requestFn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    requestQueue.push(async () => {
      try {
        const result = await requestFn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
    processQueue();
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Make a single fetch request to a MusicBrainz server
 */
async function fetchFromServer<T>(
  serverUrl: string,
  endpoint: string,
  params: Record<string, string>
): Promise<T> {
  const searchParams = new URLSearchParams({
    fmt: 'json',
    ...params,
  });

  const url = `${serverUrl}${endpoint}?${searchParams}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json',
    },
  });

  if (response.status === 503) {
    throw new Error('MusicBrainz rate limit exceeded. Please wait and try again.');
  }

  if (!response.ok) {
    throw new Error(`MusicBrainz API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Make a rate-limited request to MusicBrainz API with fallback support
 *
 * If a local server is configured and fails, automatically falls back to the public API.
 * Once fallback occurs, continues using public API for the session.
 */
async function mbFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  return queueRequest(async () => {
    // If local server previously failed, go straight to public API
    if (localServerFailed && LOCAL_MUSICBRAINZ_API) {
      return fetchFromServer<T>(PUBLIC_MUSICBRAINZ_API, endpoint, params);
    }

    try {
      return await fetchFromServer<T>(currentServer, endpoint, params);
    } catch (error) {
      // If using local server and it fails, try fallback to public API
      if (usingLocalServer && LOCAL_MUSICBRAINZ_API && !localServerFailed) {
        console.warn(
          `[MusicBrainz] Local server failed, falling back to public API:`,
          error instanceof Error ? error.message : error
        );

        // Mark local server as failed and switch to public API
        localServerFailed = true;
        usingLocalServer = false;
        currentServer = PUBLIC_MUSICBRAINZ_API;

        // Retry with public API (will now use rate limiting)
        return fetchFromServer<T>(PUBLIC_MUSICBRAINZ_API, endpoint, params);
      }

      // Re-throw if already using public API or no fallback available
      throw error;
    }
  });
}

/**
 * Search for artists by name
 */
export async function searchArtists(
  query: string,
  limit: number = 10,
  offset: number = 0
): Promise<ArtistNode[]> {
  const response = await mbFetch<MusicBrainzSearchResponse>('/artist', {
    query: `artist:"${query}"`,
    limit: String(limit),
    offset: String(offset),
  });

  return response.artists.map(mapMusicBrainzArtistToNode);
}

/**
 * Get artist by MBID with full relations
 */
export async function getArtist(mbid: string): Promise<ArtistNode> {
  const artist = await mbFetch<MusicBrainzArtist>(`/artist/${mbid}`, {
    inc: 'tags+url-rels',
  });

  return mapMusicBrainzArtistToNode(artist);
}

/**
 * Get just the life-span (birth/death or active years) for an artist
 * Used to enrich member data with death dates
 */
export async function getArtistLifeSpan(mbid: string): Promise<{ begin?: string; end?: string | null } | undefined> {
  try {
    const artist = await mbFetch<MusicBrainzArtist>(`/artist/${mbid}`, {});
    if (artist['life-span']) {
      return {
        begin: artist['life-span'].begin,
        end: artist['life-span'].ended ? artist['life-span'].end : null,
      };
    }
    return undefined;
  } catch (err) {
    console.error('Failed to fetch artist life span:', mbid, err);
    return undefined;
  }
}

/**
 * Get artist relationships (band members, collaborations, etc.)
 * Also fetches life-span data for group-type related artists to enable tenure display
 */
export async function getArtistRelationships(mbid: string): Promise<{
  artist: ArtistNode;
  relationships: ArtistRelationship[];
  relatedArtists: ArtistNode[];
}> {
  const artist = await mbFetch<MusicBrainzArtist>(`/artist/${mbid}`, {
    inc: 'artist-rels+tags',
  });

  const node = mapMusicBrainzArtistToNode(artist);
  node.loaded = true;

  const relationships: ArtistRelationship[] = [];
  const relatedArtists: ArtistNode[] = [];
  const seenArtists = new Set<string>();
  const groupsToFetch: ArtistNode[] = [];

  if (artist.relations) {
    for (const relation of artist.relations) {
      if (relation.artist && !seenArtists.has(relation.artist.id)) {
        seenArtists.add(relation.artist.id);

        const relatedNode = mapMusicBrainzArtistToNode(relation.artist);
        relatedArtists.push(relatedNode);

        // Track groups that need life-span data (for tenure display)
        if (relatedNode.type === 'group' && !relatedNode.activeYears?.begin) {
          groupsToFetch.push(relatedNode);
        }

        const edge = mapRelationToEdge(mbid, relation);
        if (edge) {
          relationships.push(edge);
        }
      }
    }
  }

  // Fetch life-span for groups (bands) to enable tenure display
  // This adds extra API calls but provides valuable data
  for (const group of groupsToFetch) {
    const lifeSpan = await getArtistLifeSpan(group.id);
    if (lifeSpan) {
      group.activeYears = lifeSpan;
    }
  }

  return { artist: node, relationships, relatedArtists };
}

/**
 * Build a graph starting from an artist
 */
export async function buildArtistGraph(mbid: string): Promise<ArtistGraph> {
  const { artist, relationships, relatedArtists } = await getArtistRelationships(mbid);

  const nodes = [
    { data: artist },
    ...relatedArtists.map(a => ({ data: a })),
  ];

  const edges = relationships.map(r => ({ data: r }));

  return { nodes, edges };
}


/**
 * Get release groups (albums, EPs, singles) for an artist
 * @param mbid - MusicBrainz artist ID
 * @param primaryTypes - Filter by primary type (e.g., ['Album', 'EP'])
 * @returns Array of release groups sorted by date (newest first), deduplicated
 */
export async function getArtistReleaseGroups(
  mbid: string,
  primaryTypes: string[] = ['Album']
): Promise<MusicBrainzReleaseGroup[]> {
  const artist = await mbFetch<MusicBrainzArtistWithReleases>(`/artist/${mbid}`, {
    inc: 'release-groups',
  });

  if (!artist['release-groups']) {
    return [];
  }

  // Filter by primary type and exclude compilations/live albums by default
  const filtered = artist['release-groups'].filter(rg => {
    const primaryType = rg['primary-type'];
    const secondaryTypes = rg['secondary-types'] || [];

    // Must match one of the requested primary types
    if (!primaryType || !primaryTypes.includes(primaryType)) {
      return false;
    }

    // Exclude compilations and live albums (unless specifically requested)
    const excludeSecondary = ['Compilation', 'Live'];
    if (secondaryTypes.some(st => excludeSecondary.includes(st))) {
      return false;
    }

    return true;
  });

  // Deduplicate by normalized title + year
  // Keep the entry with the shortest title (usually the cleanest/original version)
  const deduped = new Map<string, MusicBrainzReleaseGroup>();

  for (const rg of filtered) {
    const year = rg['first-release-date']?.substring(0, 4) || 'unknown';
    const normalizedTitle = normalizeAlbumTitle(rg.title);
    const key = `${normalizedTitle}|${year}`;

    const existing = deduped.get(key);
    if (!existing || rg.title.length < existing.title.length) {
      deduped.set(key, rg);
    }
  }

  // Sort by release date (newest first), handling partial dates
  return Array.from(deduped.values()).sort((a, b) => {
    const dateA = a['first-release-date'] || '';
    const dateB = b['first-release-date'] || '';
    return dateB.localeCompare(dateA);
  });
}

// ============================================================================
// Genre Mapping
// ============================================================================

// Map MusicBrainz tags to broader genre categories
// More specific categories are listed first to catch them before broader ones
const GENRE_CATEGORIES: Record<string, string[]> = {
  // More specific genres first (order matters for matching)
  'Punk/Hardcore': ['punk', 'hardcore', 'post-hardcore', 'hardcore punk', 'punk rock', 'emo', 'screamo', 'melodic hardcore', 'straight edge', 'crust punk', 'anarcho-punk', 'pop punk', 'skate punk', 'oi!', 'street punk', 'd-beat'],
  'Metal': ['metal', 'heavy metal', 'thrash metal', 'death metal', 'black metal', 'doom metal', 'power metal', 'progressive metal', 'metalcore', 'nu metal', 'sludge metal', 'stoner metal', 'grindcore', 'deathcore'],
  'Indie/Alternative': ['indie', 'indie rock', 'alternative', 'alternative rock', 'post-punk', 'shoegaze', 'lo-fi', 'math rock', 'noise rock', 'post-rock', 'dream pop', 'slowcore', 'sadcore', 'jangle pop', 'college rock', 'c86'],
  'Rock': ['rock', 'hard rock', 'progressive rock', 'classic rock', 'psychedelic rock', 'art rock', 'glam rock', 'soft rock', 'garage rock', 'southern rock', 'blues rock', 'roots rock', 'heartland rock'],
  'Grunge': ['grunge', 'seattle sound'],
  'New Wave': ['new wave', 'synthpop', 'post-punk revival', 'dark wave', 'coldwave', 'minimal wave', 'no wave'],
  'Jazz': ['jazz', 'bebop', 'swing', 'fusion', 'smooth jazz', 'free jazz', 'jazz fusion', 'big band', 'cool jazz', 'avant-garde jazz', 'modal jazz', 'jazz funk'],
  'Electronic': ['electronic', 'house', 'techno', 'ambient', 'edm', 'trance', 'drum and bass', 'dubstep', 'idm', 'electro', 'synthwave', 'downtempo', 'trip hop', 'breakbeat', 'uk garage', 'jungle'],
  'Classical': ['classical', 'orchestra', 'chamber', 'symphony', 'opera', 'baroque', 'romantic', 'contemporary classical', 'minimalist', 'neo-classical', 'choral'],
  'Hip-Hop': ['hip hop', 'rap', 'hip-hop', 'trap', 'gangsta rap', 'conscious hip hop', 'alternative hip hop', 'east coast hip hop', 'west coast hip hop', 'southern hip hop', 'boom bap'],
  'R&B/Soul': ['r&b', 'soul', 'funk', 'motown', 'rhythm and blues', 'neo-soul', 'contemporary r&b', 'gospel', 'disco', 'quiet storm', 'new jack swing'],
  'Folk/Country': ['folk', 'country', 'bluegrass', 'americana', 'singer-songwriter', 'folk rock', 'country rock', 'alt-country', 'traditional folk', 'acoustic', 'outlaw country', 'honky tonk', 'progressive country'],
  'Pop': ['pop', 'synth-pop', 'dance-pop', 'electropop', 'art pop', 'indie pop', 'pop rock', 'teen pop', 'power pop', 'baroque pop', 'chamber pop', 'sunshine pop'],
  'World': ['world', 'latin', 'reggae', 'afrobeat', 'bossa nova', 'salsa', 'ska', 'dub', 'world music', 'african', 'celtic', 'flamenco', 'brazilian', 'cumbia', 'tropicalia', 'highlife'],
  'Blues': ['blues', 'delta blues', 'chicago blues', 'electric blues', 'country blues', 'texas blues', 'jump blues'],
  'Experimental': ['experimental', 'avant-garde', 'noise', 'industrial', 'krautrock', 'musique concrète', 'drone', 'dark ambient', 'power electronics'],
};

/**
 * Map MusicBrainz tags to genre categories
 * Returns top matching categories sorted by tag relevance
 */
function mapTagsToGenres(tags: Array<{ name: string; count: number }> | undefined): string[] | undefined {
  if (!tags || tags.length === 0) return undefined;

  // Score each category based on matching tags
  const categoryScores: Record<string, number> = {};

  // Sort tags by count (most relevant first)
  const sortedTags = [...tags].sort((a, b) => b.count - a.count);

  for (const tag of sortedTags) {
    const tagLower = tag.name.toLowerCase();

    for (const [category, categoryTags] of Object.entries(GENRE_CATEGORIES)) {
      if (categoryTags.some(ct => tagLower.includes(ct) || ct.includes(tagLower))) {
        // Weight by tag count
        categoryScores[category] = (categoryScores[category] || 0) + tag.count;
      }
    }
  }

  // Return top 3 categories sorted by score
  const sortedCategories = Object.entries(categoryScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([category]) => category);

  return sortedCategories.length > 0 ? sortedCategories : undefined;
}

// ============================================================================
// Mapping Functions
// ============================================================================

function mapMusicBrainzArtistToNode(artist: MusicBrainzArtist): ArtistNode {
  return {
    id: artist.id,
    name: artist.name,
    type: artist.type === 'Person' ? 'person' : 'group',
    disambiguation: artist.disambiguation,
    country: artist.country,
    activeYears: artist['life-span'] ? {
      begin: artist['life-span'].begin,
      end: artist['life-span'].ended ? artist['life-span'].end : null,
    } : undefined,
    genres: mapTagsToGenres(artist.tags),
    loaded: false,
  };
}

function mapRelationToEdge(
  sourceId: string,
  relation: {
    type: string;
    direction: 'forward' | 'backward';
    artist?: MusicBrainzArtist;
    attributes?: string[];
    begin?: string;
    end?: string;
    ended?: boolean;
  }
): ArtistRelationship | null {
  if (!relation.artist) return null;

  // Relationship types to explicitly skip (not meaningful artistic connections)
  const skipTypes = new Set([
    'tribute',           // Tribute bands (e.g., "The Australian Pink Floyd Show")
    'is person',         // Identity relationships
    'named after',       // Named after relationships
  ]);

  const relationType = relation.type.toLowerCase();
  if (skipTypes.has(relationType)) {
    return null;
  }

  const typeMap: Record<string, ArtistRelationship['type']> = {
    'member of band': 'member_of',
    'founder': 'founder_of',
    'collaboration': 'collaboration',
    'vocal': 'collaboration',
    'instrument': 'collaboration',
    'producer': 'producer',
    'influenced by': 'influenced_by',
    'subgroup': 'side_project',
    'supporting musician': 'touring_member',
    // Add more mappings as needed
  };

  const mappedType = typeMap[relationType] || 'collaboration';

  // Determine source and target based on direction
  const [source, target] = relation.direction === 'forward'
    ? [sourceId, relation.artist.id]
    : [relation.artist.id, sourceId];

  return {
    id: `${source}-${mappedType}-${target}`,
    source,
    target,
    type: mappedType,
    attributes: relation.attributes,
    period: {
      begin: relation.begin,
      end: relation.ended ? relation.end : null,
    },
    direction: relation.direction === 'forward' ? 'forward' : 'backward',
  };
}
