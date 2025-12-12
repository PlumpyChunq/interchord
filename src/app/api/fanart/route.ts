import { NextRequest, NextResponse } from 'next/server';
import { apiLimiter, getClientIp, rateLimitHeaders } from '@/lib/rate-limit';

const FANART_API_KEY = process.env.NEXT_PUBLIC_FANART_API_KEY;
const FANART_BASE_URL = 'http://webservice.fanart.tv/v3/music';

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
  const mbid = searchParams.get('mbid');

  if (!mbid) {
    return NextResponse.json(
      { error: 'Missing mbid parameter' },
      { status: 400 }
    );
  }

  if (!FANART_API_KEY) {
    return NextResponse.json(
      { error: 'Fanart.tv API key not configured' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      `${FANART_BASE_URL}/${mbid}?api_key=${FANART_API_KEY}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ notFound: true }, { status: 200 });
      }
      throw new Error(`Fanart.tv API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Fanart.tv proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from Fanart.tv' },
      { status: 500 }
    );
  }
}
