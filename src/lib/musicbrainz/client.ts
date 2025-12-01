/**
 * MusicBrainz API Client
 *
 * CRITICAL: MusicBrainz has a strict 1 request/second rate limit.
 * This client implements request queuing to respect this limit.
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

const MUSICBRAINZ_API = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'InterChord/0.1.0 (https://github.com/jstone/interchord)';
const RATE_LIMIT_MS = 1100; // 1.1 seconds between requests (safety margin)

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
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;

    if (timeSinceLastRequest < RATE_LIMIT_MS) {
      await sleep(RATE_LIMIT_MS - timeSinceLastRequest);
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
 * Make a rate-limited request to MusicBrainz API
 */
async function mbFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  return queueRequest(async () => {
    const searchParams = new URLSearchParams({
      fmt: 'json',
      ...params,
    });

    const url = `${MUSICBRAINZ_API}${endpoint}?${searchParams}`;

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
 * Get artist relationships (band members, collaborations, etc.)
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

  if (artist.relations) {
    for (const relation of artist.relations) {
      if (relation.artist && !seenArtists.has(relation.artist.id)) {
        seenArtists.add(relation.artist.id);

        const relatedNode = mapMusicBrainzArtistToNode(relation.artist);
        relatedArtists.push(relatedNode);

        const edge = mapRelationToEdge(mbid, relation);
        if (edge) {
          relationships.push(edge);
        }
      }
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
 * @returns Array of release groups sorted by date (newest first)
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

  // Sort by release date (newest first), handling partial dates
  return filtered.sort((a, b) => {
    const dateA = a['first-release-date'] || '';
    const dateB = b['first-release-date'] || '';
    return dateB.localeCompare(dateA);
  });
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

  const typeMap: Record<string, ArtistRelationship['type']> = {
    'member of band': 'member_of',
    'founder': 'founder_of',
    'collaboration': 'collaboration',
    'producer': 'producer',
    'influenced by': 'influenced_by',
    // Add more mappings as needed
  };

  const mappedType = typeMap[relation.type.toLowerCase()] || 'collaboration';

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
