/**
 * Supplement Data API Route
 *
 * GET /api/supplement?mbid=xxx&name=xxx
 *
 * Returns Wikipedia-derived supplementary data for a band/group.
 * Lazily fetches and caches data on first request.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateSupplementData } from '@/lib/supplement/enricher';
import { getArtistRelationships } from '@/lib/musicbrainz/data-source';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mbid = searchParams.get('mbid');
  const name = searchParams.get('name');

  if (!mbid) {
    return NextResponse.json({ error: 'Missing mbid parameter' }, { status: 400 });
  }

  if (!name) {
    return NextResponse.json({ error: 'Missing name parameter' }, { status: 400 });
  }

  // Validate MBID format (UUID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(mbid)) {
    return NextResponse.json(
      { error: 'Invalid MBID format. Expected UUID.' },
      { status: 400 }
    );
  }

  try {
    // First, get the artist and their relationships from MusicBrainz
    // We need the related artists to match Wikipedia names
    const relationshipResult = await getArtistRelationships(mbid);

    if (!relationshipResult.data) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
    }

    const { artist, relatedArtists } = relationshipResult.data;

    // Only process groups/bands
    if (artist.type !== 'group') {
      return NextResponse.json({ error: 'Not a band/group' }, { status: 400 });
    }

    // Get or create supplement data
    const supplement = await getOrCreateSupplementData(
      mbid,
      name,
      artist.type,
      relatedArtists
    );

    if (!supplement) {
      return NextResponse.json({ error: 'No supplement data available' }, { status: 404 });
    }

    // Convert Set to array for JSON serialization
    return NextResponse.json({
      ...supplement,
      foundingMemberMbids: Array.from(supplement.foundingMemberMbids),
    });
  } catch (error) {
    console.error('[API] Supplement fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch supplement data' },
      { status: 500 }
    );
  }
}
