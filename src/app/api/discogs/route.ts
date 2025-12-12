import { NextRequest, NextResponse } from 'next/server';
import { apiLimiter, getClientIp, rateLimitHeaders } from '@/lib/rate-limit';

const DISCOGS_TOKEN = process.env.NEXT_PUBLIC_DISCOGS_TOKEN;
const DISCOGS_BASE_URL = 'https://api.discogs.com';

export async function GET(request: NextRequest) {
  // Rate limiting
  const clientIp = getClientIp(request);
  const rateLimit = apiLimiter.check(clientIp);

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      { status: 429, headers: rateLimitHeaders(rateLimit) }
    );
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (!DISCOGS_TOKEN) {
    return NextResponse.json(
      { error: 'Discogs API token not configured' },
      { status: 500 }
    );
  }

  const headers = {
    'Authorization': `Discogs token=${DISCOGS_TOKEN}`,
    'User-Agent': 'InterChord/1.0',
    'Accept': 'application/json',
  };

  try {
    let url: string;

    switch (action) {
      case 'search': {
        const query = searchParams.get('q');
        const type = searchParams.get('type') || 'artist';
        if (!query) {
          return NextResponse.json(
            { error: 'Missing q parameter for search' },
            { status: 400 }
          );
        }
        url = `${DISCOGS_BASE_URL}/database/search?q=${encodeURIComponent(query)}&type=${type}&per_page=5`;
        break;
      }

      case 'artist': {
        const artistId = searchParams.get('id');
        if (!artistId) {
          return NextResponse.json(
            { error: 'Missing id parameter for artist' },
            { status: 400 }
          );
        }
        url = `${DISCOGS_BASE_URL}/artists/${artistId}`;
        break;
      }

      case 'releases': {
        const artistId = searchParams.get('id');
        const sort = searchParams.get('sort') || 'year';
        const sortOrder = searchParams.get('sort_order') || 'desc';
        const perPage = searchParams.get('per_page') || '6';
        if (!artistId) {
          return NextResponse.json(
            { error: 'Missing id parameter for releases' },
            { status: 400 }
          );
        }
        url = `${DISCOGS_BASE_URL}/artists/${artistId}/releases?sort=${sort}&sort_order=${sortOrder}&per_page=${perPage}`;
        break;
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: search, artist, or releases' },
          { status: 400 }
        );
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ notFound: true }, { status: 200 });
      }
      throw new Error(`Discogs API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Discogs proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from Discogs' },
      { status: 500 }
    );
  }
}
