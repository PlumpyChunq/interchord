'use client';

import { useMemo } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { getArtistEvents, Concert, RECENT_THRESHOLD_MS } from './client';

export interface ConcertWithArtist extends Concert {
  artistName: string;
}

interface UseArtistConcertsResult {
  concerts: Concert[];
  isLoading: boolean;
  error: string | null;
  recentCount: number;
}

interface UseMultipleArtistsConcertsResult {
  concerts: ConcertWithArtist[];
  isLoading: boolean;
  loadingCount: number;
  totalArtists: number;
}

/**
 * Hook to fetch concerts for an artist using TanStack Query
 * @param artistName - The artist's name
 * @param mbid - Optional MusicBrainz ID for exact matching
 */
export function useArtistConcerts(artistName: string | null, mbid?: string): UseArtistConcertsResult {
  const query = useQuery({
    queryKey: ['artistConcerts', artistName, mbid],
    queryFn: () => getArtistEvents(artistName!, mbid),
    enabled: !!artistName,
    staleTime: 30 * 60 * 1000, // 30 minutes - concert data is relatively stable
  });

  // Count recent shows (within threshold period - past 90 days)
  const recentCount = useMemo(() => {
    if (!query.data) return 0;
    const now = new Date();
    const thresholdDate = new Date(now.getTime() - RECENT_THRESHOLD_MS);
    return query.data.filter(
      (c) => c.date <= now && c.date >= thresholdDate
    ).length;
  }, [query.data]);

  return {
    concerts: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    recentCount,
  };
}

/**
 * Hook to fetch concerts for multiple artists using TanStack Query's useQueries
 * for parallel fetching with automatic caching and deduplication
 */
export function useMultipleArtistsConcerts(artistNames: string[]): UseMultipleArtistsConcertsResult {
  // Use useQueries for parallel fetching
  const queries = useQueries({
    queries: artistNames.map((artistName) => ({
      queryKey: ['artistConcerts', artistName],
      queryFn: () => getArtistEvents(artistName),
      staleTime: 30 * 60 * 1000, // 30 minutes
    })),
  });

  // Aggregate results from all queries
  const concerts = useMemo(() => {
    return queries
      .flatMap((q, i) =>
        (q.data ?? []).map((c) => ({
          ...c,
          artistName: artistNames[i],
        }))
      )
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [queries, artistNames]);

  // Calculate loading state
  const loadingCount = queries.filter((q) => q.isLoading).length;
  const isLoading = loadingCount > 0;

  return {
    concerts,
    isLoading,
    loadingCount,
    totalArtists: artistNames.length,
  };
}
