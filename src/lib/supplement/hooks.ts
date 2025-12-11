'use client';

/**
 * React Hooks for Supplementary Data
 */

import { useQuery } from '@tanstack/react-query';
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
