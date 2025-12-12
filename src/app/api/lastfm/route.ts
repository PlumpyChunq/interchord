import { NextRequest, NextResponse } from 'next/server';
import { apiLimiter, getClientIp, rateLimitHeaders } from '@/lib/rate-limit';

const LASTFM_API_KEY = process.env.NEXT_PUBLIC_LASTFM_API_KEY;
const LASTFM_BASE_URL = 'https://ws.audioscrobbler.com/2.0/';

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
  const method = searchParams.get('method');
  const artist = searchParams.get('artist');
  const limit = searchParams.get('limit') || '50';

  if (!method) {
    return NextResponse.json(
      { error: 'Missing method parameter' },
      { status: 400 }
    );
  }

  if (!artist) {
    return NextResponse.json(
      { error: 'Missing artist parameter' },
      { status: 400 }
    );
  }

  if (!LASTFM_API_KEY) {
    return NextResponse.json(
      { error: 'Last.fm API key not configured' },
      { status: 500 }
    );
  }

  try {
    const params = new URLSearchParams({
      method,
      artist,
      api_key: LASTFM_API_KEY,
      format: 'json',
      limit,
    });

    const response = await fetch(`${LASTFM_BASE_URL}?${params.toString()}`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Last.fm API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Last.fm proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from Last.fm' },
      { status: 500 }
    );
  }
}
