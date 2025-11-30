'use client';

import { useQuery } from '@tanstack/react-query';
import { searchArtists, getArtistRelationships, buildArtistGraph } from './client';
import type { ArtistNode, ArtistGraph } from '@/types';

/**
 * Hook to search for artists
 */
export function useArtistSearch(query: string, enabled: boolean = true) {
  return useQuery<ArtistNode[], Error>({
    queryKey: ['artistSearch', query],
    queryFn: () => searchArtists(query, 10),
    enabled: enabled && query.length >= 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to get artist relationships
 */
export function useArtistRelationships(mbid: string | null) {
  return useQuery({
    queryKey: ['artistRelationships', mbid],
    queryFn: () => getArtistRelationships(mbid!),
    enabled: !!mbid,
    staleTime: 10 * 60 * 1000, // 10 minutes
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
