/**
 * Setlist.fm API client for fetching recent concerts/tours
 * Uses a server-side API route to avoid CORS issues
 * API docs: https://api.setlist.fm/docs/1.0/ui/index.html
 */

/** Threshold for "recent" shows - 90 days in milliseconds */
export const RECENT_THRESHOLD_MS = 90 * 24 * 60 * 60 * 1000;

export interface SetlistEvent {
  id: string;
  datetime: string;
  venue: {
    name: string;
    city: string;
    region: string;
    country: string;
  };
  title: string;
  url: string;
  offers: Array<{
    type: string;
    url: string;
    status: string;
  }>;
  lineup: string[];
}

// Keep the old interface name for compatibility
export interface BandsintownEvent extends SetlistEvent {}

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
 * Fetch recent shows for an artist via our API route (avoids CORS)
 * @param artistName - The artist's name
 * @param mbid - Optional MusicBrainz ID for exact matching (prevents "Ween" returning "Helloween")
 */
export async function getArtistEvents(artistName: string, mbid?: string): Promise<Concert[]> {
  try {
    const encodedName = encodeURIComponent(artistName);
    let url = `/api/concerts?artist=${encodedName}`;
    if (mbid) {
      url += `&mbid=${encodeURIComponent(mbid)}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      throw new Error(`Concert API error: ${response.status}`);
    }

    const data = await response.json();

    // API returns an object with error when failed, or array of events
    if (!Array.isArray(data)) {
      return [];
    }

    const events: SetlistEvent[] = data;

    // Transform to our Concert format
    return events.map((event): Concert => {
      const date = new Date(event.datetime);

      return {
        id: event.id,
        date,
        formattedDate: formatEventDate(date),
        venue: event.venue.name,
        city: event.venue.city,
        region: event.venue.region,
        country: event.venue.country,
        title: event.title || event.venue.name,
        ticketUrl: event.url || null,
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
