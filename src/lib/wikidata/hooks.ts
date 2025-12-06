/**
 * React hooks for Wikidata integration
 */

import { useQuery, useQueries } from '@tanstack/react-query';
import { getArtistBioByMbid } from './client';
import type { WikidataArtistBio } from './types';

/**
 * Fetch artist biographical data from Wikidata by MusicBrainz ID
 *
 * @param mbid - MusicBrainz artist ID
 * @param enabled - Whether to enable the query (default: true)
 */
export function useArtistBio(mbid: string | undefined, enabled: boolean = true) {
  return useQuery<WikidataArtistBio | null>({
    queryKey: ['wikidata', 'artist-bio', mbid],
    queryFn: () => (mbid ? getArtistBioByMbid(mbid) : null),
    enabled: enabled && !!mbid,
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
    retry: 1,
  });
}

/**
 * Fetch biographical data for multiple artists (e.g., band members)
 *
 * @param mbids - Array of MusicBrainz artist IDs
 * @param enabled - Whether to enable the queries (default: true)
 */
export function useMultipleArtistBios(mbids: string[], enabled: boolean = true) {
  const queries = useQueries({
    queries: mbids.map((mbid) => ({
      queryKey: ['wikidata', 'artist-bio', mbid],
      queryFn: () => getArtistBioByMbid(mbid),
      enabled: enabled && !!mbid,
      staleTime: 1000 * 60 * 60, // 1 hour
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      retry: 1,
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const bios = queries
    .map((q) => q.data)
    .filter((bio): bio is WikidataArtistBio => bio !== null && bio !== undefined);

  return { bios, isLoading };
}
