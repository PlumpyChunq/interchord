import { NextRequest, NextResponse } from 'next/server';
import { apiLimiter, getClientIp, rateLimitHeaders } from '@/lib/rate-limit';

const SETLIST_FM_BASE_URL = 'https://api.setlist.fm/rest/1.0';
const API_KEY = process.env.SETLIST_FM_API_KEY;

interface SetlistFmVenue {
  name: string;
  city: {
    name: string;
    state?: string;
    stateCode?: string;
    country: {
      name: string;
      code: string;
    };
  };
}

interface SetlistFmArtist {
  mbid?: string;
  name: string;
  sortName?: string;
}

interface SetlistFmSetlist {
  id: string;
  eventDate: string; // dd-MM-yyyy format
  artist: SetlistFmArtist;
  venue: SetlistFmVenue;
  tour?: { name: string };
  url: string;
}

interface SetlistFmResponse {
  setlist?: SetlistFmSetlist[];
  total?: number;
  page?: number;
  itemsPerPage?: number;
}

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

  const searchParams = request.nextUrl.searchParams;
  const artistName = searchParams.get('artist');
  const artistMbid = searchParams.get('mbid');

  if (!artistName && !artistMbid) {
    return NextResponse.json({ error: 'Artist name or MBID is required' }, { status: 400 });
  }

  if (!API_KEY) {
    return NextResponse.json({ error: 'Setlist.fm API key not configured' }, { status: 500 });
  }

  try {
    // Prefer MBID search for exact results, fall back to name search
    let url: string;
    if (artistMbid) {
      // MBID gives exact artist match - no fuzzy search issues
      url = `${SETLIST_FM_BASE_URL}/artist/${artistMbid}/setlists?p=1`;
    } else {
      const encodedName = encodeURIComponent(artistName!);
      url = `${SETLIST_FM_BASE_URL}/search/setlists?artistName=${encodedName}&p=1`;
    }

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'x-api-key': API_KEY,
      },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json([]);
      }
      return NextResponse.json(
        { error: `Setlist.fm API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data: SetlistFmResponse = await response.json();

    if (!data.setlist || !Array.isArray(data.setlist)) {
      return NextResponse.json([]);
    }

    // Filter to only include setlists from the exact artist (case-insensitive)
    // This prevents "Ween" from returning "Helloween" results when using name search
    // MBID search already returns exact results, so skip filtering
    let filteredSetlists = data.setlist;
    if (!artistMbid && artistName) {
      const normalizedSearchName = artistName.toLowerCase().trim();
      filteredSetlists = data.setlist.filter((setlist) => {
        const setlistArtistName = setlist.artist?.name?.toLowerCase().trim() || '';
        return setlistArtistName === normalizedSearchName;
      });
    }

    // Transform to our concert format
    const concerts = filteredSetlists.map((setlist) => {
      // Parse date from dd-MM-yyyy to ISO format
      const [day, month, year] = setlist.eventDate.split('-');
      const dateStr = `${year}-${month}-${day}`;

      return {
        id: setlist.id,
        datetime: dateStr,
        venue: {
          name: setlist.venue.name,
          city: setlist.venue.city.name,
          region: setlist.venue.city.state || setlist.venue.city.stateCode || '',
          country: setlist.venue.city.country.name,
        },
        title: setlist.tour?.name || '',
        url: setlist.url,
        offers: [],
        lineup: [],
      };
    });

    return NextResponse.json(concerts);
  } catch (error) {
    console.error('Error fetching artist events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch concert data' },
      { status: 500 }
    );
  }
}
