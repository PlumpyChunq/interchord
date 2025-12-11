/**
 * Supplementary Data PostgreSQL Database Client
 *
 * Connects to interchord-db (port 5433) to store Wikipedia-derived
 * artist data that supplements MusicBrainz.
 *
 * Following same patterns as musicbrainz/db-client.ts:
 * - Singleton connection pool
 * - Configuration via environment variables
 * - Health check and graceful shutdown
 */

import { Pool, PoolConfig } from 'pg';
import type {
  FoundingMember,
  SupplementData,
  MatchResult,
  ExtractedBandInfo,
} from './types';

// ============================================================================
// Configuration
// ============================================================================

const DB_CONFIG: PoolConfig = {
  host: process.env.SUPPLEMENT_DB_HOST || process.env.MUSICBRAINZ_DB_HOST || 'localhost',
  port: parseInt(process.env.SUPPLEMENT_DB_PORT || '5433', 10),
  database: process.env.SUPPLEMENT_DB_NAME || 'interchord_db',
  user: process.env.SUPPLEMENT_DB_USER || 'interchord',
  password: process.env.SUPPLEMENT_DB_PASSWORD || process.env.POSTGRES_PASSWORD,

  // Smaller pool than MusicBrainz (less frequent writes)
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Note: QUERY_TIMEOUT_MS and SUPPLEMENT_CACHE_TTL_MS are handled by the
// PostgreSQL queries themselves (30 day interval in WHERE clause)

// ============================================================================
// Singleton Pool
// ============================================================================

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool(DB_CONFIG);

    pool.on('error', (err) => {
      console.error('[Supplement DB] Unexpected pool error:', err.message);
    });

    if (process.env.NODE_ENV === 'development') {
      pool.on('connect', () => {
        console.log('[Supplement DB] New client connected to pool');
      });
    }
  }
  return pool;
}

// ============================================================================
// Health Check
// ============================================================================

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
    console.warn('[Supplement DB] Connection test failed:', (error as Error).message);
    return false;
  }
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Get supplement data for an artist if it exists and is fresh
 */
export async function getSupplementData(mbid: string): Promise<SupplementData | null> {
  try {
    const client = await getPool().connect();
    try {
      // Check if we have data and it's not stale
      const artistResult = await client.query<{
        mbid: string;
        name: string;
        wikipedia_title: string | null;
        formation_year: number | null;
        formation_city: string | null;
        formation_state: string | null;
        formation_country: string | null;
        wikipedia_extract: string | null;
        parsed_at: Date | null;
        created_at: Date;
      }>(
        `SELECT * FROM artist_supplement
         WHERE mbid = $1
         AND parsed_at > NOW() - INTERVAL '30 days'`,
        [mbid]
      );

      if (artistResult.rows.length === 0) {
        return null; // No data or stale
      }

      const artistRow = artistResult.rows[0];

      // Get founding members
      const membersResult = await client.query<{
        id: number;
        band_mbid: string;
        member_name: string;
        member_mbid: string | null;
        instruments: string[] | null;
        confidence: number;
        match_method: string;
        created_at: Date;
      }>(
        `SELECT * FROM founding_member WHERE band_mbid = $1`,
        [mbid]
      );

      const foundingMembers: FoundingMember[] = membersResult.rows.map((row) => ({
        id: row.id,
        bandMbid: row.band_mbid,
        memberName: row.member_name,
        memberMbid: row.member_mbid ?? undefined,
        instruments: row.instruments ?? undefined,
        confidence: row.confidence,
        matchMethod: row.match_method as 'exact' | 'fuzzy' | 'unmatched',
        createdAt: row.created_at,
      }));

      // Build set of founding member MBIDs for quick lookup
      const foundingMemberMbids = new Set<string>();
      for (const member of foundingMembers) {
        if (member.memberMbid) {
          foundingMemberMbids.add(member.memberMbid);
        }
      }

      return {
        artist: {
          mbid: artistRow.mbid,
          name: artistRow.name,
          wikipediaTitle: artistRow.wikipedia_title ?? undefined,
          formationYear: artistRow.formation_year ?? undefined,
          formationCity: artistRow.formation_city ?? undefined,
          formationState: artistRow.formation_state ?? undefined,
          formationCountry: artistRow.formation_country ?? undefined,
          wikipediaExtract: artistRow.wikipedia_extract ?? undefined,
          parsedAt: artistRow.parsed_at ?? undefined,
          createdAt: artistRow.created_at,
        },
        foundingMembers,
        foundingMemberMbids,
      };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[Supplement DB] Error getting supplement data:', (error as Error).message);
    return null;
  }
}

/**
 * Store supplement data for an artist
 */
export async function storeSupplementData(
  mbid: string,
  name: string,
  wikipediaTitle: string,
  wikipediaExtract: string,
  extracted: ExtractedBandInfo,
  matchResults: MatchResult[]
): Promise<boolean> {
  try {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');

      // Upsert artist supplement
      await client.query(
        `INSERT INTO artist_supplement
         (mbid, name, wikipedia_title, formation_year, formation_city, formation_state, formation_country, wikipedia_extract, parsed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (mbid) DO UPDATE SET
           name = EXCLUDED.name,
           wikipedia_title = EXCLUDED.wikipedia_title,
           formation_year = EXCLUDED.formation_year,
           formation_city = EXCLUDED.formation_city,
           formation_state = EXCLUDED.formation_state,
           formation_country = EXCLUDED.formation_country,
           wikipedia_extract = EXCLUDED.wikipedia_extract,
           parsed_at = NOW()`,
        [
          mbid,
          name,
          wikipediaTitle,
          extracted.formationYear ?? null,
          extracted.formationCity ?? null,
          extracted.formationState ?? null,
          extracted.formationCountry ?? null,
          wikipediaExtract,
        ]
      );

      // Delete existing founding members (will re-insert)
      await client.query('DELETE FROM founding_member WHERE band_mbid = $1', [mbid]);

      // Insert founding members
      for (const match of matchResults) {
        await client.query(
          `INSERT INTO founding_member
           (band_mbid, member_name, member_mbid, instruments, confidence, match_method)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            mbid,
            match.extractedName,
            match.matchedMbid,
            match.instruments ?? null,
            match.confidence,
            match.method,
          ]
        );
      }

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[Supplement DB] Error storing supplement data:', (error as Error).message);
    return false;
  }
}

/**
 * Check if supplement data exists (regardless of freshness)
 */
export async function hasSupplementData(mbid: string): Promise<boolean> {
  try {
    const client = await getPool().connect();
    try {
      const result = await client.query(
        'SELECT 1 FROM artist_supplement WHERE mbid = $1',
        [mbid]
      );
      return result.rows.length > 0;
    } finally {
      client.release();
    }
  } catch {
    return false;
  }
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[Supplement DB] Pool closed');
  }
}
