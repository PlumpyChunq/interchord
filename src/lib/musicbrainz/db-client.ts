/**
 * MusicBrainz PostgreSQL Database Client
 *
 * Cloud-friendly database client with connection pooling following best practices:
 * - Singleton connection pool (created once, reused)
 * - Configuration via environment variables
 * - Health check for fallback logic
 * - Graceful shutdown support
 * - Query timeout handling
 *
 * @see https://node-postgres.com/features/pooling
 */

import { Pool, PoolConfig } from 'pg';
import type { ArtistNode, ArtistRelationship } from '@/types';

// ============================================================================
// Configuration (all from environment variables for cloud deployment)
// ============================================================================

const DB_CONFIG: PoolConfig = {
  host: process.env.MUSICBRAINZ_DB_HOST || 'localhost',
  port: parseInt(process.env.MUSICBRAINZ_DB_PORT || '5432', 10),
  database: process.env.MUSICBRAINZ_DB_NAME || 'musicbrainz_db',
  user: process.env.MUSICBRAINZ_DB_USER || 'musicbrainz',
  password: process.env.MUSICBRAINZ_DB_PASSWORD || 'musicbrainz',

  // Connection pool settings (tuned for cloud deployment)
  max: parseInt(process.env.MUSICBRAINZ_DB_POOL_SIZE || '10', 10),
  idleTimeoutMillis: 30000, // Close idle clients after 30s
  connectionTimeoutMillis: parseInt(
    process.env.MUSICBRAINZ_DB_TIMEOUT || '2000',
    10
  ), // 2s connection timeout for fast fallback
};

// Query timeout for individual queries
const QUERY_TIMEOUT_MS = parseInt(
  process.env.MUSICBRAINZ_DB_QUERY_TIMEOUT || '5000',
  10
);

// ============================================================================
// Singleton Pool (best practice: create once, reuse)
// ============================================================================

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool(DB_CONFIG);

    // Handle pool errors (required for production)
    pool.on('error', (err) => {
      console.error('[MusicBrainz DB] Unexpected pool error:', err.message);
    });

    // Log pool connect events in development
    if (process.env.NODE_ENV === 'development') {
      pool.on('connect', () => {
        console.log('[MusicBrainz DB] New client connected to pool');
      });
    }
  }
  return pool;
}

// ============================================================================
// Health Check
// ============================================================================

/**
 * Test database connectivity with timeout
 * Used by data-source to determine if we should fall back to API
 */
export async function testConnection(): Promise<boolean> {
  try {
    const client = await getPool().connect();
    try {
      await client.query('SELECT 1');
      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    console.warn('[MusicBrainz DB] Connection test failed:', (error as Error).message);
    return false;
  }
}

// ============================================================================
// Graceful Shutdown (for cloud deployments)
// ============================================================================

/**
 * Close all pool connections gracefully
 * Call this on SIGTERM/SIGINT for clean shutdown
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[MusicBrainz DB] Connection pool closed');
  }
}

// ============================================================================
// Query Helpers
// ============================================================================

/**
 * Execute a query with timeout
 */
async function query<T>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const client = await getPool().connect();
  try {
    // Set statement timeout for this query
    await client.query(`SET statement_timeout = ${QUERY_TIMEOUT_MS}`);
    const result = await client.query(sql, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

// ============================================================================
// Artist Queries
// ============================================================================

interface DbArtist {
  gid: string;
  name: string;
  sort_name: string;
  type_name: string | null;
  comment: string | null;
  country_code: string | null;
  begin_date_year: number | null;
  begin_date_month: number | null;
  begin_date_day: number | null;
  end_date_year: number | null;
  end_date_month: number | null;
  end_date_day: number | null;
  ended: boolean;
}

interface DbRelationship {
  entity0_gid: string;
  entity0_name: string;
  entity0_type: string | null;
  entity0_comment: string | null;
  entity1_gid: string;
  entity1_name: string;
  entity1_type: string | null;
  entity1_comment: string | null;
  link_type_name: string;
  link_type_gid: string;
  begin_date_year: number | null;
  begin_date_month: number | null;
  begin_date_day: number | null;
  end_date_year: number | null;
  end_date_month: number | null;
  end_date_day: number | null;
  ended: boolean;
}

/**
 * Format date from MusicBrainz year/month/day columns
 */
function formatDate(year: number | null, month: number | null, day: number | null): string | undefined {
  if (!year) return undefined;
  if (!month) return String(year);
  if (!day) return `${year}-${String(month).padStart(2, '0')}`;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Map database artist row to ArtistNode
 */
function mapDbArtistToNode(row: DbArtist, genres?: string[]): ArtistNode {
  return {
    id: row.gid,
    name: row.name,
    type: row.type_name === 'Person' ? 'person' : 'group',
    disambiguation: row.comment || undefined,
    country: row.country_code || undefined,
    activeYears: row.begin_date_year
      ? {
          begin: formatDate(row.begin_date_year, row.begin_date_month, row.begin_date_day),
          end: row.ended
            ? formatDate(row.end_date_year, row.end_date_month, row.end_date_day)
            : null,
        }
      : undefined,
    genres,
    loaded: false,
  };
}

// ============================================================================
// Genre Category Mapping (matching client.ts for consistency)
// ============================================================================

const GENRE_CATEGORIES: Record<string, string[]> = {
  'Rock': ['rock', 'hard rock', 'alternative rock', 'indie rock', 'punk rock', 'post-punk', 'grunge', 'progressive rock', 'psychedelic rock', 'garage rock', 'classic rock', 'art rock', 'glam rock', 'southern rock', 'folk rock', 'roots rock', 'stoner rock'],
  'Metal': ['metal', 'heavy metal', 'death metal', 'black metal', 'thrash metal', 'doom metal', 'power metal', 'metalcore', 'progressive metal', 'nu metal', 'symphonic metal', 'groove metal', 'sludge metal'],
  'Pop': ['pop', 'synthpop', 'art pop', 'dance-pop', 'electropop', 'indie pop', 'dream pop', 'power pop', 'teen pop', 'k-pop', 'j-pop', 'europop', 'bubblegum pop'],
  'Hip-Hop': ['hip hop', 'hip-hop', 'rap', 'trap', 'gangsta rap', 'conscious hip hop', 'boom bap', 'southern hip hop', 'west coast hip hop', 'east coast hip hop', 'alternative hip hop', 'underground hip hop'],
  'Electronic': ['electronic', 'edm', 'house', 'techno', 'trance', 'dubstep', 'drum and bass', 'ambient', 'idm', 'electro', 'synthwave', 'downtempo', 'breakbeat'],
  'R&B': ['r&b', 'rhythm and blues', 'soul', 'neo-soul', 'motown', 'funk', 'disco', 'contemporary r&b', 'new jack swing'],
  'Jazz': ['jazz', 'bebop', 'swing', 'fusion', 'smooth jazz', 'free jazz', 'cool jazz', 'acid jazz', 'latin jazz', 'avant-garde jazz'],
  'Classical': ['classical', 'orchestral', 'opera', 'chamber music', 'baroque', 'romantic', 'contemporary classical', 'minimalist', 'neo-classical'],
  'Country': ['country', 'country rock', 'bluegrass', 'americana', 'outlaw country', 'alt-country', 'country pop', 'honky tonk', 'western swing'],
  'Folk': ['folk', 'folk rock', 'singer-songwriter', 'traditional folk', 'contemporary folk', 'indie folk', 'freak folk', 'anti-folk'],
  'Punk': ['punk', 'punk rock', 'hardcore', 'post-hardcore', 'pop punk', 'emo', 'skate punk', 'anarcho-punk', 'crust punk', 'melodic hardcore'],
  'Indie': ['indie', 'indie rock', 'indie pop', 'indie folk', 'lo-fi', 'shoegaze', 'post-rock', 'math rock', 'slowcore', 'noise pop'],
  'World': ['world', 'latin', 'reggae', 'afrobeat', 'bossa nova', 'salsa', 'ska', 'dub', 'world music', 'african', 'celtic', 'flamenco', 'brazilian', 'cumbia', 'tropicalia', 'highlife'],
  'Blues': ['blues', 'delta blues', 'chicago blues', 'electric blues', 'country blues', 'texas blues', 'jump blues'],
  'Experimental': ['experimental', 'avant-garde', 'noise', 'industrial', 'krautrock', 'musique concrète', 'drone', 'dark ambient', 'power electronics'],
};

/**
 * Map database tags to genre categories (same logic as client.ts)
 */
function mapTagsToGenres(tags: Array<{ name: string; count: number }> | undefined): string[] | undefined {
  if (!tags || tags.length === 0) return undefined;

  const categoryScores: Record<string, number> = {};
  const sortedTags = [...tags].sort((a, b) => b.count - a.count);

  for (const tag of sortedTags) {
    const tagLower = tag.name.toLowerCase();
    for (const [category, categoryTags] of Object.entries(GENRE_CATEGORIES)) {
      if (categoryTags.some(ct => tagLower.includes(ct) || ct.includes(tagLower))) {
        categoryScores[category] = (categoryScores[category] || 0) + tag.count;
      }
    }
  }

  const sortedCategories = Object.entries(categoryScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([category]) => category);

  return sortedCategories.length > 0 ? sortedCategories : undefined;
}

/**
 * Fetch tags for an artist from the database
 */
async function getArtistTagsFromDB(mbid: string): Promise<Array<{ name: string; count: number }>> {
  const sql = `
    SELECT t.name, at.count
    FROM musicbrainz.artist_tag at
    JOIN musicbrainz.tag t ON at.tag = t.id
    JOIN musicbrainz.artist a ON at.artist = a.id
    WHERE a.gid = $1::uuid
    ORDER BY at.count DESC
    LIMIT 20
  `;

  try {
    const rows = await query<{ name: string; count: number }>(sql, [mbid]);
    return rows;
  } catch (error) {
    console.error('[DB] Failed to fetch artist tags:', error);
    return [];
  }
}

/**
 * Search artists by name
 * Uses PostgreSQL full-text search for better performance
 */
export async function searchArtistsFromDB(
  searchQuery: string,
  limit: number = 10,
  offset: number = 0
): Promise<ArtistNode[]> {
  const sql = `
    SELECT
      a.gid,
      a.name,
      a.sort_name,
      at.name as type_name,
      a.comment,
      iso.code as country_code,
      a.begin_date_year,
      a.begin_date_month,
      a.begin_date_day,
      a.end_date_year,
      a.end_date_month,
      a.end_date_day,
      a.ended
    FROM musicbrainz.artist a
    LEFT JOIN musicbrainz.artist_type at ON a.type = at.id
    LEFT JOIN musicbrainz.area ar ON a.area = ar.id
    LEFT JOIN musicbrainz.iso_3166_1 iso ON ar.id = iso.area
    WHERE a.name ILIKE $1 OR a.sort_name ILIKE $1
    ORDER BY
      CASE WHEN LOWER(a.name) = LOWER($2) THEN 0 ELSE 1 END,
      a.name
    LIMIT $3 OFFSET $4
  `;

  const rows = await query<DbArtist>(sql, [
    `%${searchQuery}%`,
    searchQuery,
    limit,
    offset,
  ]);

  return rows.map(row => mapDbArtistToNode(row));
}

/**
 * Get artist by MBID (with tags/genres)
 */
export async function getArtistFromDB(mbid: string): Promise<ArtistNode | null> {
  const sql = `
    SELECT
      a.gid,
      a.name,
      a.sort_name,
      at.name as type_name,
      a.comment,
      iso.code as country_code,
      a.begin_date_year,
      a.begin_date_month,
      a.begin_date_day,
      a.end_date_year,
      a.end_date_month,
      a.end_date_day,
      a.ended
    FROM musicbrainz.artist a
    LEFT JOIN musicbrainz.artist_type at ON a.type = at.id
    LEFT JOIN musicbrainz.area ar ON a.area = ar.id
    LEFT JOIN musicbrainz.iso_3166_1 iso ON ar.id = iso.area
    WHERE a.gid = $1::uuid
  `;

  const rows = await query<DbArtist>(sql, [mbid]);
  if (rows.length === 0) return null;

  // Fetch tags and map to genres
  const tags = await getArtistTagsFromDB(mbid);
  const genres = mapTagsToGenres(tags);

  return mapDbArtistToNode(rows[0], genres);
}

/**
 * Get artist relationships (band members, collaborations, etc.)
 */
export async function getArtistRelationshipsFromDB(mbid: string): Promise<{
  artist: ArtistNode;
  relationships: ArtistRelationship[];
  relatedArtists: ArtistNode[];
}> {
  // First get the main artist
  const artist = await getArtistFromDB(mbid);
  if (!artist) {
    throw new Error(`Artist not found: ${mbid}`);
  }
  artist.loaded = true;

  // Get all artist-to-artist relationships (both directions)
  const sql = `
    SELECT
      a1.gid as entity0_gid,
      a1.name as entity0_name,
      at1.name as entity0_type,
      a1.comment as entity0_comment,
      a2.gid as entity1_gid,
      a2.name as entity1_name,
      at2.name as entity1_type,
      a2.comment as entity1_comment,
      lt.name as link_type_name,
      lt.gid as link_type_gid,
      l.begin_date_year,
      l.begin_date_month,
      l.begin_date_day,
      l.end_date_year,
      l.end_date_month,
      l.end_date_day,
      l.ended
    FROM musicbrainz.l_artist_artist laa
    JOIN musicbrainz.link l ON laa.link = l.id
    JOIN musicbrainz.link_type lt ON l.link_type = lt.id
    JOIN musicbrainz.artist a1 ON laa.entity0 = a1.id
    JOIN musicbrainz.artist a2 ON laa.entity1 = a2.id
    LEFT JOIN musicbrainz.artist_type at1 ON a1.type = at1.id
    LEFT JOIN musicbrainz.artist_type at2 ON a2.type = at2.id
    WHERE a1.gid = $1::uuid OR a2.gid = $1::uuid
  `;

  const rows = await query<DbRelationship>(sql, [mbid]);

  const relationships: ArtistRelationship[] = [];
  const relatedArtistsMap = new Map<string, ArtistNode>();

  // Relationship type mapping (matching existing client.ts)
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
  };

  // Skip these relationship types
  const skipTypes = new Set(['tribute', 'is person', 'named after']);

  for (const row of rows) {
    const linkType = row.link_type_name.toLowerCase();

    if (skipTypes.has(linkType)) continue;

    const mappedType = typeMap[linkType] || 'collaboration';

    // Determine which entity is the queried artist and which is the related one
    // entity0 is source, entity1 is target in MusicBrainz relationships
    const queriedIsEntity0 = row.entity0_gid === mbid;
    const relatedGid = queriedIsEntity0 ? row.entity1_gid : row.entity0_gid;
    const relatedName = queriedIsEntity0 ? row.entity1_name : row.entity0_name;
    const relatedType = queriedIsEntity0 ? row.entity1_type : row.entity0_type;
    const relatedComment = queriedIsEntity0 ? row.entity1_comment : row.entity0_comment;

    // Add related artist if not already in map
    if (!relatedArtistsMap.has(relatedGid) && relatedGid !== mbid) {
      relatedArtistsMap.set(relatedGid, {
        id: relatedGid,
        name: relatedName,
        type: relatedType === 'Person' ? 'person' : 'group',
        disambiguation: relatedComment || undefined,
        loaded: false,
      });
    }

    // Create relationship (source -> target direction preserved from original link)
    relationships.push({
      id: `${row.entity0_gid}-${mappedType}-${row.entity1_gid}`,
      source: row.entity0_gid,
      target: row.entity1_gid,
      type: mappedType,
      period: {
        begin: formatDate(row.begin_date_year, row.begin_date_month, row.begin_date_day),
        end: row.ended
          ? formatDate(row.end_date_year, row.end_date_month, row.end_date_day)
          : null,
      },
      direction: queriedIsEntity0 ? 'forward' : 'backward',
    });
  }

  return {
    artist,
    relationships,
    relatedArtists: Array.from(relatedArtistsMap.values()),
  };
}

/**
 * Get artist life span (for enriching member data)
 */
export async function getArtistLifeSpanFromDB(
  mbid: string
): Promise<{ begin?: string; end?: string | null } | undefined> {
  const sql = `
    SELECT
      begin_date_year,
      begin_date_month,
      begin_date_day,
      end_date_year,
      end_date_month,
      end_date_day,
      ended
    FROM musicbrainz.artist
    WHERE gid = $1::uuid
  `;

  const rows = await query<{
    begin_date_year: number | null;
    begin_date_month: number | null;
    begin_date_day: number | null;
    end_date_year: number | null;
    end_date_month: number | null;
    end_date_day: number | null;
    ended: boolean;
  }>(sql, [mbid]);

  if (rows.length === 0) return undefined;

  const row = rows[0];
  if (!row.begin_date_year) return undefined;

  return {
    begin: formatDate(row.begin_date_year, row.begin_date_month, row.begin_date_day),
    end: row.ended
      ? formatDate(row.end_date_year, row.end_date_month, row.end_date_day)
      : null,
  };
}
