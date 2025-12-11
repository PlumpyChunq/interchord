'use client';

/**
 * React Hooks for Supplementary Data
 */

import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import type { SupplementData } from './types';

/**
 * Fetch supplement data via API route
 * Use this in client components to get founding member data
 */
export function useSupplementData(
  mbid: string | undefined,
  artistName: string | undefined,
  artistType: string | undefined,
  enabled: boolean = true
) {
  return useQuery<SupplementData | null>({
    queryKey: ['supplement', mbid],
    queryFn: async () => {
      if (!mbid || !artistName || artistType !== 'group') {
        return null;
      }

      const response = await fetch(
        `/api/supplement?mbid=${encodeURIComponent(mbid)}&name=${encodeURIComponent(artistName)}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error('Failed to fetch supplement data');
      }

      const data = await response.json();

      // Convert foundingMemberMbids back to Set
      if (data && data.foundingMemberMbids) {
        data.foundingMemberMbids = new Set(data.foundingMemberMbids);
      }

      return data;
    },
    enabled: enabled && !!mbid && !!artistName && artistType === 'group',
    staleTime: 1000 * 60 * 60, // 1 hour
    retry: false, // Don't retry if Wikipedia fails
  });
}

/**
 * Background enrichment for favorite groups
 *
 * Pre-warms the cache by fetching Wikipedia data for favorites.
 * Runs lazily with delays to avoid overwhelming Wikipedia.
 * Only processes the 10 most recent group favorites.
 */
export function useBackgroundEnrichment(
  favorites: Array<{ id: string; name: string; type: string }>,
  enabled: boolean = true
) {
  const enrichedRef = useRef<Set<string>>(new Set());
  const isEnrichingRef = useRef(false);

  useEffect(() => {
    if (!enabled || isEnrichingRef.current) return;

    // Only process groups, limit to 10
    const groups = favorites
      .filter((f) => f.type === 'group')
      .filter((f) => !enrichedRef.current.has(f.id))
      .slice(0, 10);

    if (groups.length === 0) return;

    isEnrichingRef.current = true;

    // Process in background with delays
    const enrichAsync = async () => {
      for (const group of groups) {
        try {
          // Fetch supplement data (will cache if DB available, otherwise just warm memory)
          const response = await fetch(
            `/api/supplement?mbid=${encodeURIComponent(group.id)}&name=${encodeURIComponent(group.name)}`
          );

          if (response.ok) {
            enrichedRef.current.add(group.id);
          }

          // Wait 2 seconds between requests to be nice to Wikipedia
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } catch {
          // Silently ignore failures - this is background work
        }
      }
      isEnrichingRef.current = false;
    };

    // Start after a delay (let the UI settle first)
    const timeoutId = setTimeout(enrichAsync, 5000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [favorites, enabled]);
}
