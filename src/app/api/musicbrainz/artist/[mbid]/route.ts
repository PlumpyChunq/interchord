/**
 * MusicBrainz Artist Details API Route
 *
 * GET /api/musicbrainz/artist/{mbid}
 * GET /api/musicbrainz/artist/{mbid}?include=relationships
 *
 * Uses local PostgreSQL database when available, falls back to MusicBrainz API.
 * Returns source indicator for UI display.
 *
 * Rate limited: 100 requests per minute per IP
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getArtist,
  getArtistRelationships,
  getArtistLifeSpan,
} from '@/lib/musicbrainz/data-source';
import { apiLimiter, getClientIp, rateLimitHeaders } from '@/lib/rate-limit';

interface RouteParams {
  params: Promise<{ mbid: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  // Rate limiting
  const clientIp = getClientIp(request);
  const rateLimit = apiLimiter.check(clientIp);

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      { status: 429, headers: rateLimitHeaders(rateLimit) }
    );
  }

  const { mbid } = await params;
  const searchParams = request.nextUrl.searchParams;
  const include = searchParams.get('include');

  // Validate MBID format (UUID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(mbid)) {
    return NextResponse.json(
      { error: 'Invalid MBID format. Expected UUID.' },
      { status: 400 }
    );
  }

  try {
    // If requesting relationships, use the full relationships endpoint
    if (include === 'relationships') {
      const result = await getArtistRelationships(mbid);
      return NextResponse.json({
        artist: result.data.artist,
        relationships: result.data.relationships,
        relatedArtists: result.data.relatedArtists,
        source: result.source,
        latencyMs: result.latencyMs,
      });
    }

    // If requesting life-span only
    if (include === 'life-span') {
      const result = await getArtistLifeSpan(mbid);
      return NextResponse.json({
        lifeSpan: result.data,
        source: result.source,
        latencyMs: result.latencyMs,
      });
    }

    // Default: just get the artist
    const result = await getArtist(mbid);

    if (!result.data) {
      return NextResponse.json(
        { error: 'Artist not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      artist: result.data,
      source: result.source,
      latencyMs: result.latencyMs,
    });
  } catch (error) {
    console.error('[API] Artist fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch artist' },
      { status: 500 }
    );
  }
}
