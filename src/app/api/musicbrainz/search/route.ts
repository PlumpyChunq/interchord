/**
 * MusicBrainz Artist Search API Route
 *
 * GET /api/musicbrainz/search?q=artist_name&limit=10&offset=0
 *
 * Uses Solr for fast text search when available, falls back to PostgreSQL,
 * then to MusicBrainz API. Returns source indicator for UI display.
 *
 * Rate limited: 30 requests per minute per IP
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchArtistsSolr, testSolrConnection } from '@/lib/musicbrainz/solr-client';
import { searchArtists } from '@/lib/musicbrainz/data-source';
import { searchLimiter, getClientIp, rateLimitHeaders } from '@/lib/rate-limit';

// Cache Solr availability status
let solrAvailable: boolean | null = null;
let lastSolrCheck = 0;
const SOLR_CHECK_INTERVAL_MS = 30000;

async function isSolrAvailable(): Promise<boolean> {
  const now = Date.now();
  if (solrAvailable !== null && now - lastSolrCheck < SOLR_CHECK_INTERVAL_MS) {
    return solrAvailable;
  }

  solrAvailable = await testSolrConnection();
  lastSolrCheck = now;

  if (!solrAvailable) {
    console.warn('[Search] Solr unavailable, will use DB fallback');
  }

  return solrAvailable;
}

export async function GET(request: NextRequest) {
  // Rate limiting
  const clientIp = getClientIp(request);
  const rateLimit = searchLimiter.check(clientIp);

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      { status: 429, headers: rateLimitHeaders(rateLimit) }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: 'Query parameter "q" is required and must be at least 2 characters' },
      { status: 400 }
    );
  }

  const startTime = Date.now();

  try {
    // Try Solr first (optimized for text search, much faster than ILIKE)
    if (await isSolrAvailable()) {
      try {
        const { artists, total } = await searchArtistsSolr(query, limit, offset);
        return NextResponse.json({
          artists,
          total,
          source: 'solr',
          latencyMs: Date.now() - startTime,
        });
      } catch (error) {
        console.error('[Search] Solr failed, falling back to DB:', error);
        solrAvailable = false;
      }
    }

    // Fallback to PostgreSQL/API via data-source
    const result = await searchArtists(query, limit, offset);

    return NextResponse.json({
      artists: result.data,
      source: result.source,
      latencyMs: result.latencyMs,
    });
  } catch (error) {
    console.error('[API] Search error:', error);
    return NextResponse.json(
      { error: 'Failed to search artists' },
      { status: 500 }
    );
  }
}
