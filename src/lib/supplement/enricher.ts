/**
 * Supplement Data Enricher
 *
 * Orchestrates the process of:
 * 1. Checking if we have cached supplement data
 * 2. Fetching Wikipedia if not cached
 * 3. Parsing the article for founding members
 * 4. Matching names to MusicBrainz data
 * 5. Storing results in the database
 * 6. Returning merged data
 */

import type { ArtistNode } from '@/types';
import type { SupplementData } from './types';
import { searchWikipedia } from '@/lib/wikipedia/client';
import { parseWikipediaIntro } from './parser';
import { matchExtractedMembers } from './matcher';
import { getSupplementData, storeSupplementData, testConnection } from './db-client';

// Rate limiting for Wikipedia requests
let lastWikipediaRequest = 0;
const WIKIPEDIA_MIN_INTERVAL_MS = 100; // At least 100ms between requests

/**
 * Get or create supplement data for a band/group
 *
 * This is the main entry point - call this when loading artist relationships.
 * It handles caching automatically (30-day TTL in database).
 */
export async function getOrCreateSupplementData(
  mbid: string,
  artistName: string,
  artistType: string,
  relatedArtists: ArtistNode[]
): Promise<SupplementData | null> {
  // Only process groups/bands, not solo artists
  if (artistType !== 'group') {
    return null;
  }

  // Check if database is available
  const dbAvailable = await testConnection();
  if (!dbAvailable) {
    console.warn('[Supplement] Database not available, skipping enrichment');
    return null;
  }

  // Check for cached data first
  const cached = await getSupplementData(mbid);
  if (cached) {
    console.log(`[Supplement] Cache hit for ${artistName}`);
    return cached;
  }

  // Cache miss - fetch from Wikipedia
  console.log(`[Supplement] Cache miss for ${artistName}, fetching Wikipedia...`);

  // Rate limit Wikipedia requests
  const now = Date.now();
  const timeSinceLast = now - lastWikipediaRequest;
  if (timeSinceLast < WIKIPEDIA_MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, WIKIPEDIA_MIN_INTERVAL_MS - timeSinceLast));
  }
  lastWikipediaRequest = Date.now();

  // Fetch Wikipedia article
  const wikipedia = await searchWikipedia(artistName);
  if (!wikipedia || !wikipedia.extract) {
    console.log(`[Supplement] No Wikipedia article found for ${artistName}`);
    return null;
  }

  // Parse the intro text
  const extracted = parseWikipediaIntro(wikipedia.extract);

  if (extracted.foundingMembers.length === 0) {
    console.log(`[Supplement] No founding members found in Wikipedia for ${artistName}`);
    // Still store the result to avoid re-fetching
    await storeSupplementData(
      mbid,
      artistName,
      wikipedia.title,
      wikipedia.extract,
      extracted,
      []
    );
    return {
      artist: {
        mbid,
        name: artistName,
        wikipediaTitle: wikipedia.title,
        formationYear: extracted.formationYear,
        formationCity: extracted.formationCity,
        formationCountry: extracted.formationCountry,
        wikipediaExtract: wikipedia.extract,
        parsedAt: new Date(),
        createdAt: new Date(),
      },
      foundingMembers: [],
      foundingMemberMbids: new Set(),
    };
  }

  // Match extracted names to MusicBrainz data
  const matchResults = matchExtractedMembers(extracted.foundingMembers, relatedArtists);

  console.log(
    `[Supplement] Found ${extracted.foundingMembers.length} founders in Wikipedia, ` +
    `matched ${matchResults.filter((m) => m.matchedMbid).length} to MusicBrainz`
  );

  // Store in database
  const stored = await storeSupplementData(
    mbid,
    artistName,
    wikipedia.title,
    wikipedia.extract,
    extracted,
    matchResults
  );

  if (!stored) {
    console.warn(`[Supplement] Failed to store data for ${artistName}`);
  }

  // Build result
  const foundingMemberMbids = new Set<string>();
  for (const match of matchResults) {
    if (match.matchedMbid) {
      foundingMemberMbids.add(match.matchedMbid);
    }
  }

  return {
    artist: {
      mbid,
      name: artistName,
      wikipediaTitle: wikipedia.title,
      formationYear: extracted.formationYear,
      formationCity: extracted.formationCity,
      formationCountry: extracted.formationCountry,
      wikipediaExtract: wikipedia.extract,
      parsedAt: new Date(),
      createdAt: new Date(),
    },
    foundingMembers: matchResults.map((m, i) => ({
      id: i,
      bandMbid: mbid,
      memberName: m.extractedName,
      memberMbid: m.matchedMbid ?? undefined,
      instruments: m.instruments,
      confidence: m.confidence,
      matchMethod: m.method,
      createdAt: new Date(),
    })),
    foundingMemberMbids,
  };
}

/**
 * Background enrichment for favorites
 *
 * Call this to enrich data for favorited artists without blocking the UI.
 * Processes at most `limit` artists at a time.
 */
export async function enrichFavorites(
  favorites: { id: string; name: string; type: string }[],
  relatedArtistsMap: Map<string, ArtistNode[]>,
  limit: number = 10
): Promise<void> {
  // Only process groups
  const groups = favorites.filter((f) => f.type === 'group').slice(0, limit);

  for (const group of groups) {
    const relatedArtists = relatedArtistsMap.get(group.id) || [];

    // Skip if no relationship data available
    if (relatedArtists.length === 0) continue;

    try {
      // This will cache the result if not already cached
      await getOrCreateSupplementData(group.id, group.name, group.type, relatedArtists);

      // Small delay between requests to be nice to Wikipedia
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.warn(`[Supplement] Background enrichment failed for ${group.name}:`, error);
    }
  }
}
