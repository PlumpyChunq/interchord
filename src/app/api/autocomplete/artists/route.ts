/**
 * Artist Autocomplete API Route
 *
 * GET /api/autocomplete/artists?q=query&limit=10
 *
 * Fast autocomplete using Solr for type-ahead suggestions.
 * Falls back to PostgreSQL if Solr is unavailable.
 *
 * Rate limited: 100 requests per minute per IP (higher limit for autocomplete)
 */

import { NextRequest, NextResponse } from 'next/server';
import { autocompleteArtists, testSolrConnection } from '@/lib/musicbrainz/solr-client';
import { searchArtists } from '@/lib/musicbrainz/data-source';
import { apiLimiter, getClientIp, rateLimitHeaders } from '@/lib/rate-limit';

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
    console.warn('[Autocomplete] Solr unavailable, will use DB fallback');
  }

  return solrAvailable;
}

export async function GET(request: NextRequest) {
  // Rate limiting (higher limit for autocomplete since it's used for typing)
  const clientIp = getClientIp(request);
  const rateLimit = apiLimiter.check(clientIp);

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', results: [], artists: [] },
      { status: 429, headers: rateLimitHeaders(rateLimit) }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 25);

  if (!query || query.length < 2) {
    return NextResponse.json({
      results: [],
      artists: [], // Backwards compatibility
      entityType: 'artist',
      entityTypeLabel: 'Artists',
      source: 'none',
    });
  }

  const startTime = Date.now();

  try {
    // Try Solr first (much faster for autocomplete)
    if (await isSolrAvailable()) {
      try {
        const artists = await autocompleteArtists(query, limit);
        return NextResponse.json({
          results: artists,
          artists, // Backwards compatibility
          entityType: 'artist',
          entityTypeLabel: 'Artists',
          source: 'solr',
          latencyMs: Date.now() - startTime,
        });
      } catch (error) {
        console.error('[Autocomplete] Solr failed, falling back to DB:', error);
        solrAvailable = false;
      }
    }

    // Fallback to PostgreSQL via data-source
    const result = await searchArtists(query, limit, 0);
    return NextResponse.json({
      results: result.data,
      artists: result.data, // Backwards compatibility
      entityType: 'artist',
      entityTypeLabel: 'Artists',
      source: result.source === 'local' ? 'postgres' : 'api',
      latencyMs: Date.now() - startTime,
    });
  } catch (error) {
    console.error('[Autocomplete] Error:', error);
    return NextResponse.json(
      {
        error: 'Autocomplete failed',
        results: [],
        artists: [], // Backwards compatibility
        entityType: 'artist',
        entityTypeLabel: 'Artists',
      },
      { status: 500 }
    );
  }
}
