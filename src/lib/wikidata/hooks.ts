/**
 * React hooks for Wikidata integration
 */

import { useQuery } from '@tanstack/react-query';
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
