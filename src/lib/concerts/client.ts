/**
 * Bandsintown API client for fetching upcoming concerts/tours
 * API docs: https://app.swaggerhub.com/apis/Bandsintown/PublicAPI/3.0.1
 */

const BANDSINTOWN_BASE_URL = 'https://rest.bandsintown.com';
const APP_ID = 'SmartAppleMusic';

export interface BandsintownEvent {
  id: string;
  artist_id: string;
  url: string;
  on_sale_datetime: string;
  datetime: string;
  title: string;
  description: string;
  venue: {
    name: string;
    location: string;
    city: string;
    region: string;
    country: string;
    latitude: string;
    longitude: string;
  };
  lineup: string[];
  offers: Array<{
    type: string;
    url: string;
    status: string;
  }>;
}

export interface Concert {
  id: string;
  date: Date;
  formattedDate: string;
  venue: string;
  city: string;
  region: string;
  country: string;
  title: string;
  ticketUrl: string | null;
  lineup: string[];
}

/**
 * Fetch upcoming events for an artist from Bandsintown
 */
export async function getArtistEvents(artistName: string): Promise<Concert[]> {
  try {
    // URL encode the artist name
    const encodedName = encodeURIComponent(artistName);
    const url = `${BANDSINTOWN_BASE_URL}/artists/${encodedName}/events?app_id=${APP_ID}`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      if (response.status === 404) {
        // Artist not found on Bandsintown
        return [];
      }
      throw new Error(`Bandsintown API error: ${response.status}`);
    }

    const data = await response.json();

    // API returns an object with message when no events, or array of events
    if (!Array.isArray(data)) {
      return [];
    }

    const events: BandsintownEvent[] = data;

    // Transform to our Concert format
    return events.map((event): Concert => {
      const date = new Date(event.datetime);
      const ticketOffer = event.offers?.find(o => o.status === 'available');

      return {
        id: event.id,
        date,
        formattedDate: formatEventDate(date),
        venue: event.venue.name,
        city: event.venue.city,
        region: event.venue.region,
        country: event.venue.country,
        title: event.title || `${event.venue.name}`,
        ticketUrl: ticketOffer?.url || event.url || null,
        lineup: event.lineup || [],
      };
    });
  } catch (error) {
    console.error('Error fetching artist events:', error);
    return [];
  }
}

/**
 * Format date for display
 */
function formatEventDate(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  };
  return date.toLocaleDateString('en-US', options);
}

/**
 * Check if an event is happening soon (within 30 days)
 */
export function isUpcoming(concert: Concert): boolean {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return concert.date >= now && concert.date <= thirtyDaysFromNow;
}

/**
 * Group concerts by month
 */
export function groupConcertsByMonth(concerts: Concert[]): Map<string, Concert[]> {
  const grouped = new Map<string, Concert[]>();

  for (const concert of concerts) {
    const monthKey = concert.date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });

    if (!grouped.has(monthKey)) {
      grouped.set(monthKey, []);
    }
    grouped.get(monthKey)!.push(concert);
  }

  return grouped;
}
