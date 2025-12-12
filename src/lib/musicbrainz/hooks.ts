'use client';

import { useQuery } from '@tanstack/react-query';
import { buildArtistGraph } from './client';
import { cacheGet, cacheSet, CacheTTL } from '@/lib/cache';
import type { ArtistNode, ArtistRelationship, ArtistGraph } from '@/types';

/**
 * Search artists via API route with short-term caching
 */
async function searchArtistsCached(query: string, limit: number = 10): Promise<ArtistNode[]> {
  const cacheKey = `artist-search-${query.toLowerCase()}-${limit}`;

  // Check cache (short TTL for searches - 5 minutes)
  const cached = cacheGet<ArtistNode[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const response = await fetch(
    `/api/musicbrainz/search?q=${encodeURIComponent(query)}&limit=${limit}`
  );

  if (!response.ok) {
    throw new Error(`Search failed: ${response.status}`);
  }

  const data = await response.json();
  const artists = data.artists || [];

  // Cache for 5 minutes (searches are more dynamic)
  cacheSet(cacheKey, artists, CacheTTL.SHORT);

  return artists;
}

interface RelationshipsData {
  artist: ArtistNode;
  relationships: ArtistRelationship[];
  relatedArtists: ArtistNode[];
}

/**
 * Fetch relationships via API route with localStorage caching
 * Note: Cache is invalidated if artist data is missing genres (for migration)
 */
async function fetchRelationshipsCached(mbid: string): Promise<RelationshipsData> {
  const cacheKey = `artist-relationships-${mbid}`;

  // Check localStorage cache first (instant)
  const cached = cacheGet<RelationshipsData>(cacheKey);
  console.log('[hooks] fetchRelationshipsCached called for:', mbid);
  console.log('[hooks] Cache result:', cached ? 'HIT' : 'MISS');

  if (cached) {
    // Check if cached data is missing genres (migration to new schema)
    // If so, refetch to get genres from updated API
    const hasGenres = cached.artist?.genres && cached.artist.genres.length > 0;
    console.log('[hooks] Cached artist:', cached.artist?.name, 'hasGenres:', hasGenres, 'genres:', cached.artist?.genres);
    if (hasGenres) {
      console.log('[hooks] Returning cached data with genres');
      return cached;
    }
    console.log('[hooks] Cache hit but missing genres, refetching:', mbid);
  }

  // Fetch via API route (uses local DB when available)
  console.log('[hooks] Fetching from API...');
  const response = await fetch(`/api/musicbrainz/artist/${mbid}?include=relationships`);

  if (!response.ok) {
    throw new Error(`Failed to fetch relationships: ${response.status}`);
  }

  const data = await response.json();
  console.log('[hooks] API response artist:', data.artist?.name, 'genres:', data.artist?.genres);

  const result: RelationshipsData = {
    artist: data.artist,
    relationships: data.relationships,
    relatedArtists: data.relatedArtists,
  };

  // Cache for 1 week
  cacheSet(cacheKey, result, CacheTTL.LONG);
  console.log('[hooks] Cached result with genres:', result.artist?.genres);

  return result;
}

/**
 * Hook to search for artists (uses local DB via API route)
 */
export function useArtistSearch(query: string, enabled: boolean = true) {
  return useQuery<ArtistNode[], Error>({
    queryKey: ['artistSearch', query],
    queryFn: () => searchArtistsCached(query, 10),
    enabled: enabled && query.length >= 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to get artist relationships with localStorage caching
 * Uses API route which leverages local DB when available
 *
 * Note: staleTime is 0 to ensure queryFn always runs, allowing localStorage
 * cache to handle freshness and genre migration logic.
 */
export function useArtistRelationships(mbid: string | null) {
  return useQuery({
    queryKey: ['artistRelationships', mbid],
    queryFn: () => fetchRelationshipsCached(mbid!),
    enabled: !!mbid,
    staleTime: 0, // Always call queryFn - localStorage cache handles freshness
    gcTime: 5 * 60 * 1000, // Keep in memory for 5 minutes
  });
}

/**
 * Hook to build artist graph
 */
export function useArtistGraph(mbid: string | null) {
  return useQuery<ArtistGraph, Error>({
    queryKey: ['artistGraph', mbid],
    queryFn: () => buildArtistGraph(mbid!),
    enabled: !!mbid,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}
