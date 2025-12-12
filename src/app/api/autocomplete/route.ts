/**
 * Unified Autocomplete API Route
 *
 * Provides fast autocomplete search across all MusicBrainz entity types.
 *
 * Query parameters:
 * - q: Search query (required, min 2 characters)
 * - type: Entity type (optional, default: 'artist')
 *   - artist, recording, release, release-group, work, label, place, area, event
 * - limit: Max results (optional, default: 10, max: 50)
 *
 * Example:
 * GET /api/autocomplete?q=beat&type=artist
 * GET /api/autocomplete?q=yesterday&type=recording
 * GET /api/autocomplete?q=abbey&type=release
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  autocompleteEntities,
  testSolrConnection,
} from '@/lib/musicbrainz/solr-client';
import { searchArtists } from '@/lib/musicbrainz/data-source';
import type { SearchEntityType } from '@/types';

// Valid entity types
const VALID_ENTITY_TYPES: SearchEntityType[] = [
  'artist',
  'recording',
  'release',
  'release-group',
  'work',
  'label',
  'place',
  'area',
  'event',
];

// Entity type labels for user-friendly display
const ENTITY_TYPE_LABELS: Record<SearchEntityType, string> = {
  artist: 'Artists',
  recording: 'Songs',
  release: 'Albums',
  'release-group': 'Album Groups',
  work: 'Compositions',
  label: 'Labels',
  place: 'Places',
  area: 'Areas',
  event: 'Events',
};

// Solr availability cache
let solrAvailable: boolean | null = null;
let lastSolrCheck = 0;
const SOLR_CHECK_INTERVAL = 30000; // 30 seconds

async function isSolrAvailable(): Promise<boolean> {
  const now = Date.now();
  if (solrAvailable !== null && now - lastSolrCheck < SOLR_CHECK_INTERVAL) {
    return solrAvailable;
  }

  solrAvailable = await testSolrConnection();
  lastSolrCheck = now;
  return solrAvailable;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const searchParams = request.nextUrl.searchParams;

  // Parse and validate parameters
  const query = searchParams.get('q')?.trim() || '';
  const entityType = (searchParams.get('type') || 'artist') as SearchEntityType;
  const limitParam = searchParams.get('limit');
  const limit = Math.min(Math.max(parseInt(limitParam || '10', 10) || 10, 1), 50);

  // Validate query
  if (query.length < 2) {
    return NextResponse.json({
      results: [],
      entityType,
      entityTypeLabel: ENTITY_TYPE_LABELS[entityType] || entityType,
      source: 'none',
      latencyMs: Date.now() - startTime,
      error: 'Query must be at least 2 characters',
    });
  }

  // Validate entity type
  if (!VALID_ENTITY_TYPES.includes(entityType)) {
    return NextResponse.json(
      {
        error: `Invalid entity type: ${entityType}. Valid types: ${VALID_ENTITY_TYPES.join(', ')}`,
      },
      { status: 400 }
    );
  }

  // Check Solr availability
  const solrOk = await isSolrAvailable();

  if (!solrOk) {
    // Solr not available - return error for non-artist searches
    // Artist searches could fall back to PostgreSQL, but other entity types
    // don't have a fallback implementation yet
    if (entityType !== 'artist') {
      return NextResponse.json({
        results: [],
        entityType,
        entityTypeLabel: ENTITY_TYPE_LABELS[entityType] || entityType,
        source: 'fallback',
        latencyMs: Date.now() - startTime,
        error: `Search for ${entityType} requires Solr (currently unavailable)`,
      });
    }

    // For artists, fall back to PostgreSQL/API search directly
    try {
      const result = await searchArtists(query, limit, 0);
      return NextResponse.json({
        results: result.data,
        entityType,
        entityTypeLabel: ENTITY_TYPE_LABELS[entityType] || entityType,
        source: result.source === 'local' ? 'postgres' : 'api',
        latencyMs: Date.now() - startTime,
      });
    } catch (fallbackError) {
      console.error('[Autocomplete API] Artist fallback error:', fallbackError);
      return NextResponse.json({
        results: [],
        entityType,
        entityTypeLabel: ENTITY_TYPE_LABELS[entityType] || entityType,
        source: 'error',
        latencyMs: Date.now() - startTime,
        error: 'Search failed',
      });
    }
  }

  // Search with Solr
  try {
    const results = await autocompleteEntities(entityType, query, limit);

    return NextResponse.json({
      results,
      entityType,
      entityTypeLabel: ENTITY_TYPE_LABELS[entityType] || entityType,
      total: results.length,
      source: 'solr',
      latencyMs: Date.now() - startTime,
    });
  } catch (error) {
    console.error(`[Autocomplete API] ${entityType} search error:`, error);

    // For artists, fall back to PostgreSQL/API search
    if (entityType === 'artist') {
      try {
        const result = await searchArtists(query, limit, 0);
        return NextResponse.json({
          results: result.data,
          entityType,
          entityTypeLabel: ENTITY_TYPE_LABELS[entityType] || entityType,
          source: result.source === 'local' ? 'postgres' : 'api',
          latencyMs: Date.now() - startTime,
        });
      } catch (fallbackError) {
        console.error('[Autocomplete API] Artist fallback error:', fallbackError);
      }
    }

    return NextResponse.json(
      {
        results: [],
        entityType,
        entityTypeLabel: ENTITY_TYPE_LABELS[entityType] || entityType,
        source: 'error',
        latencyMs: Date.now() - startTime,
        error: 'Search failed',
      },
      { status: 500 }
    );
  }
}

/**
 * Return available entity types and their labels
 */
export async function OPTIONS() {
  return NextResponse.json({
    entityTypes: VALID_ENTITY_TYPES,
    labels: ENTITY_TYPE_LABELS,
  });
}
