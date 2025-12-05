// eslint-disable-next-line @typescript-eslint/no-unused-vars -- getMusicKitInstance kept for future use
import { initializeMusicKit, getMusicKitInstance } from './config';
import { cacheGet, cacheSet, CacheTTL } from '@/lib/cache';
import type {
  AppleMusicArtist,
  AppleMusicAlbum,
  LibraryArtistsResponse,
  LibraryAlbumsResponse,
  CatalogSearchResponse,
} from './types';

export { formatArtworkUrl } from './types';

// Ensure MusicKit is initialized and authorized before making API calls
async function ensureAuthorized() {
  const music = await initializeMusicKit();
  if (!music.isAuthorized) {
    throw new Error('Not authorized. Please connect Apple Music first.');
  }
  return music;
}

/**
 * Get all artists from user's library (paginated)
 */
export async function getLibraryArtists(
  limit: number = 100,
  offset: number = 0
): Promise<LibraryArtistsResponse> {
  const music = await ensureAuthorized();

  // MusicKit v3 expects query params directly, not nested under 'parameters'
  const response = await music.api.music<LibraryArtistsResponse>(
    '/v1/me/library/artists',
    { limit, offset }
  );

  return response.data;
}

/**
 * Get all library artists (handles pagination)
 */
export async function getAllLibraryArtists(): Promise<AppleMusicArtist[]> {
  const allArtists: AppleMusicArtist[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await getLibraryArtists(limit, offset);
    allArtists.push(...response.data);

    if (!response.next || response.data.length < limit) {
      break;
    }

    offset += limit;

    // Safety limit to prevent infinite loops
    if (offset > 10000) {
      break;
    }
  }

  return allArtists;
}

/**
 * Get top N artists from library (most recently added/played)
 */
export async function getTopLibraryArtists(count: number = 10): Promise<AppleMusicArtist[]> {
  const response = await getLibraryArtists(count, 0);
  return response.data;
}

/**
 * Get albums for a specific library artist
 */
export async function getLibraryArtistAlbums(
  artistId: string
): Promise<AppleMusicAlbum[]> {
  const music = await ensureAuthorized();

  const response = await music.api.music<LibraryAlbumsResponse>(
    `/v1/me/library/artists/${artistId}/albums`
  );

  return response.data.data;
}

/**
 * Search Apple Music catalog for an artist by name
 */
export async function searchCatalogArtist(
  artistName: string,
  storefront: string = 'us'
): Promise<AppleMusicArtist | null> {
  // Check cache first
  const cacheKey = `apple-music-search-${artistName.toLowerCase()}`;
  const cached = cacheGet<AppleMusicArtist | null>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  const music = await initializeMusicKit();

  try {
    // MusicKit v3 expects query params directly
    const response = await music.api.music<CatalogSearchResponse>(
      `/v1/catalog/${storefront}/search`,
      {
        term: artistName,
        types: 'artists',
        limit: 5,
      }
    );

    const artists = response.data.results?.artists?.data || [];

    // Find best match (exact name match preferred)
    const exactMatch = artists.find(
      (a) => a.attributes.name.toLowerCase() === artistName.toLowerCase()
    );
    const result = exactMatch || artists[0] || null;

    // Cache the result
    cacheSet(cacheKey, result, CacheTTL.LONG);

    return result;
  } catch (error) {
    console.error('Error searching Apple Music catalog:', error);
    return null;
  }
}

/**
 * Get artist details from catalog (includes artwork, albums)
 */
export async function getCatalogArtist(
  artistId: string,
  storefront: string = 'us'
): Promise<AppleMusicArtist | null> {
  // Check cache first
  const cacheKey = `apple-music-artist-${artistId}`;
  const cached = cacheGet<AppleMusicArtist>(cacheKey);
  if (cached) {
    return cached;
  }

  const music = await initializeMusicKit();

  try {
    // MusicKit v3 expects query params directly
    const response = await music.api.music<{ data: AppleMusicArtist[] }>(
      `/v1/catalog/${storefront}/artists/${artistId}`,
      { include: 'albums' }
    );

    const artist = response.data.data[0] || null;

    if (artist) {
      cacheSet(cacheKey, artist, CacheTTL.LONG);
    }

    return artist;
  } catch (error) {
    console.error('Error fetching catalog artist:', error);
    return null;
  }
}

/**
 * Get artist's top albums from catalog
 */
export async function getCatalogArtistAlbums(
  artistId: string,
  storefront: string = 'us',
  limit: number = 10
): Promise<AppleMusicAlbum[]> {
  // Check cache first
  const cacheKey = `apple-music-albums-${artistId}`;
  const cached = cacheGet<AppleMusicAlbum[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const music = await initializeMusicKit();

  try {
    // MusicKit v3 expects query params directly
    const response = await music.api.music<{ data: AppleMusicAlbum[] }>(
      `/v1/catalog/${storefront}/artists/${artistId}/albums`,
      { limit }
    );

    const albums = response.data.data || [];
    cacheSet(cacheKey, albums, CacheTTL.LONG);

    return albums;
  } catch (error) {
    console.error('Error fetching artist albums:', error);
    return [];
  }
}

// Types for Apple Music personalization responses
interface AppleMusicItem {
  id: string;
  type: string;
  attributes: {
    name?: string;
    artistName?: string;
    artwork?: { url: string };
    dateAdded?: string; // ISO date string, e.g., "2024-12-01T10:30:00Z"
  };
}

/**
 * Get user's heavy rotation (most frequently played)
 * Tries multiple endpoint variations as Apple's API has inconsistent naming
 */
export async function getHeavyRotation(limit: number = 25): Promise<AppleMusicItem[]> {
  const music = await ensureAuthorized();

  // Try different endpoint variations
  const endpoints = [
    '/v1/me/history/heavy-rotation',
    '/v1/me/heavy-rotation',
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await music.api.music<{ data: AppleMusicItem[] }>(
        endpoint,
        { limit }
      );
      console.log(`Heavy rotation (${endpoint}) raw response:`, JSON.stringify(response.data).slice(0, 500));
      if (response.data.data && response.data.data.length > 0) {
        return response.data.data;
      }
    } catch (error) {
      console.warn(`Heavy rotation endpoint ${endpoint} failed:`, error);
    }
  }

  return [];
}

/**
 * Get user's recently played items (albums, playlists, stations)
 * Tries multiple endpoint variations as Apple's API has inconsistent naming
 */
export async function getRecentlyPlayed(limit: number = 25): Promise<AppleMusicItem[]> {
  const music = await ensureAuthorized();

  const endpoints = [
    '/v1/me/recent/played',
    '/v1/me/history/recent',
    '/v1/me/recentPlayed',
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await music.api.music<{ data: AppleMusicItem[] }>(
        endpoint,
        { limit }
      );
      console.log(`Recently played (${endpoint}) raw response:`, JSON.stringify(response.data).slice(0, 500));
      if (response.data.data && response.data.data.length > 0) {
        return response.data.data;
      }
    } catch (error) {
      console.warn(`Recently played endpoint ${endpoint} failed:`, error);
    }
  }

  return [];
}

/**
 * Get user's recently played tracks (individual songs)
 * Tries multiple endpoint variations as Apple's API has inconsistent naming
 */
export async function getRecentlyPlayedTracks(limit: number = 25): Promise<AppleMusicItem[]> {
  const music = await ensureAuthorized();

  const endpoints = [
    '/v1/me/recent/played/tracks',
    '/v1/me/recentPlayed/tracks',
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await music.api.music<{ data: AppleMusicItem[] }>(
        endpoint,
        { limit }
      );
      console.log(`Recent tracks (${endpoint}) raw response:`, JSON.stringify(response.data).slice(0, 500));
      if (response.data.data && response.data.data.length > 0) {
        return response.data.data;
      }
    } catch (error) {
      console.warn(`Recent tracks endpoint ${endpoint} failed:`, error);
    }
  }

  return [];
}

/**
 * Get user's recently added items to library
 * Tries multiple endpoint variations as Apple's API has inconsistent naming
 */
export async function getRecentlyAdded(limit: number = 25): Promise<AppleMusicItem[]> {
  const music = await ensureAuthorized();

  const endpoints = [
    '/v1/me/library/recently-added',
    '/v1/me/library/recentlyAdded',
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await music.api.music<{ data: AppleMusicItem[] }>(
        endpoint,
        { limit }
      );
      console.log(`Recently added (${endpoint}) raw response:`, JSON.stringify(response.data).slice(0, 500));
      if (response.data.data && response.data.data.length > 0) {
        return response.data.data;
      }
    } catch (error) {
      console.warn(`Recently added endpoint ${endpoint} failed:`, error);
    }
  }

  return [];
}

/**
 * Calculate recency bonus based on dateAdded
 * Items added in the last week get 3x bonus, last month 2x, last 3 months 1.5x
 */
function getRecencyBonus(dateAdded: string | undefined): number {
  if (!dateAdded) return 1;

  try {
    const addedDate = new Date(dateAdded);
    const now = new Date();
    const daysSinceAdded = (now.getTime() - addedDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceAdded <= 7) return 3;      // Last week: 3x bonus
    if (daysSinceAdded <= 30) return 2;     // Last month: 2x bonus
    if (daysSinceAdded <= 90) return 1.5;   // Last 3 months: 1.5x bonus
    return 1;                                // Older: no bonus
  } catch {
    return 1;
  }
}

/**
 * Extract unique artist names from all personalization endpoints
 * Returns artists in order of relevance (weighted by source, frequency, and recency)
 */
export async function getTopArtistNames(): Promise<string[]> {
  // Fetch from all sources in parallel
  // NOTE: Apple Music API has a max limit of ~25 for most personalization endpoints
  // Using limit=50+ causes 400 errors
  const [heavyRotation, recentlyPlayed, recentTracks, recentlyAdded] = await Promise.all([
    getHeavyRotation(25),
    getRecentlyPlayed(25),
    getRecentlyPlayedTracks(25),
    getRecentlyAdded(25),
  ]);

  // Track artist frequency with weighted scoring
  const artistCounts = new Map<string, number>();

  const addArtist = (name: string | undefined, baseWeight: number, dateAdded?: string) => {
    if (!name) return;
    // Apply recency bonus to base weight
    const recencyBonus = getRecencyBonus(dateAdded);
    const weight = baseWeight * recencyBonus;

    // Handle "Artist1 & Artist2" format - split and add both
    const artists = name.split(/\s*[&,]\s*/).map(a => a.trim()).filter(a => a.length > 0);
    for (const artist of artists) {
      artistCounts.set(artist, (artistCounts.get(artist) || 0) + weight);
    }
  };

  // Helper to extract artist from any item type
  const getArtistFromItem = (item: AppleMusicItem): string | undefined => {
    const type = item.type;
    const attrs = item.attributes;

    // For stations, the "name" field IS the artist name (e.g., "Johnny Cash", "Macklemore")
    if (type === 'stations') {
      return attrs.name;
    }
    // For songs, albums, library-albums, library-songs - use artistName
    if (attrs.artistName && attrs.artistName !== 'Various Artists') {
      return attrs.artistName;
    }
    // For artist items, use name
    if (type === 'artists' || type === 'library-artists') {
      return attrs.name;
    }
    return undefined;
  };

  // Heavy rotation = highest weight (most played)
  for (const item of heavyRotation) {
    const artist = getArtistFromItem(item);
    addArtist(artist, 5, item.attributes.dateAdded);
  }

  // Recently played tracks = high weight (current listening)
  // Note: recent tracks are already in recency order, give position bonus
  for (let i = 0; i < recentTracks.length; i++) {
    const item = recentTracks[i];
    // First items get more weight (position bonus: 3 down to 1)
    const positionBonus = Math.max(1, 3 - (i / recentTracks.length) * 2);
    const artist = getArtistFromItem(item);
    addArtist(artist, 3 * positionBonus, item.attributes.dateAdded);
  }

  // Recently played (albums/playlists/stations) = medium weight with position bonus
  for (let i = 0; i < recentlyPlayed.length; i++) {
    const item = recentlyPlayed[i];
    const positionBonus = Math.max(1, 2 - (i / recentlyPlayed.length));
    const artist = getArtistFromItem(item);
    addArtist(artist, 2 * positionBonus, item.attributes.dateAdded);
  }

  // Recently added = gets recency bonus from dateAdded
  for (const item of recentlyAdded) {
    const artist = getArtistFromItem(item);
    addArtist(artist, 2, item.attributes.dateAdded);
  }

  // Sort by score (highest first) and return names
  const sortedArtists = Array.from(artistCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  console.log(`Apple Music: Found ${sortedArtists.length} unique artists from personalization endpoints`);
  console.log(`Apple Music: Heavy rotation items: ${heavyRotation.length}`);
  console.log(`Apple Music: Recently played items: ${recentlyPlayed.length}`);
  console.log(`Apple Music: Recent tracks: ${recentTracks.length}`);
  console.log(`Apple Music: Recently added items: ${recentlyAdded.length}`);
  console.log(`Apple Music: Top 10 artists by score:`, sortedArtists.slice(0, 10));

  return sortedArtists;
}

/**
 * Get curated top artists - combines ALL personalization endpoints
 * This is the main function for importing (similar to Spotify's getCuratedTopArtists)
 */
export async function getCuratedTopArtists(maxArtists: number = 30): Promise<string[]> {
  const artistNames = await getTopArtistNames();

  // If we got artists from personalization, use those
  if (artistNames.length > 0) {
    console.log(`Apple Music: Using ${Math.min(artistNames.length, maxArtists)} artists from personalization`);
    return artistNames.slice(0, maxArtists);
  }

  // If all personalization endpoints are empty, return empty (will fall back to library)
  console.log('Apple Music: No personalization data found, will fall back to library');
  return [];
}
