/**
 * Wikipedia API Client
 * Fetches short summaries/bios for artists from Wikipedia
 */

const WIKIPEDIA_API = 'https://en.wikipedia.org/api/rest_v1';

export interface WikipediaSummary {
  title: string;
  extract: string;
  description?: string;
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
  content_urls?: {
    desktop: { page: string };
    mobile: { page: string };
  };
}

/**
 * Fetch a summary from Wikipedia for a given title
 * Returns null if not found
 */
export async function getWikipediaSummary(title: string): Promise<WikipediaSummary | null> {
  try {
    // Clean up the title for Wikipedia URL format
    const encodedTitle = encodeURIComponent(title.replace(/ /g, '_'));

    const response = await fetch(`${WIKIPEDIA_API}/page/summary/${encodedTitle}`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      console.warn(`Wikipedia API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    // Skip disambiguation pages
    if (data.type === 'disambiguation') {
      return null;
    }

    return {
      title: data.title,
      extract: data.extract || '',
      description: data.description,
      thumbnail: data.thumbnail,
      content_urls: data.content_urls,
    };
  } catch (error) {
    console.warn('Failed to fetch Wikipedia summary:', error);
    return null;
  }
}

/**
 * Search Wikipedia and get the best matching article summary
 * Useful when the exact title doesn't match
 */
export async function searchWikipedia(query: string): Promise<WikipediaSummary | null> {
  try {
    // First try exact match
    const directResult = await getWikipediaSummary(query);
    if (directResult) {
      return directResult;
    }

    // Try with "(musician)" suffix for disambiguation
    const musicianResult = await getWikipediaSummary(`${query} (musician)`);
    if (musicianResult) {
      return musicianResult;
    }

    // Try with "(band)" suffix
    const bandResult = await getWikipediaSummary(`${query} (band)`);
    if (bandResult) {
      return bandResult;
    }

    return null;
  } catch (error) {
    console.warn('Failed to search Wikipedia:', error);
    return null;
  }
}
