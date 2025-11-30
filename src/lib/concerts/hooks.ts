'use client';

import { useState, useEffect } from 'react';
import { getArtistEvents, Concert } from './client';

interface UseArtistConcertsResult {
  concerts: Concert[];
  isLoading: boolean;
  error: string | null;
  upcomingCount: number;
}

/**
 * Hook to fetch concerts for an artist
 */
export function useArtistConcerts(artistName: string | null): UseArtistConcertsResult {
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!artistName) {
      setConcerts([]);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getArtistEvents(artistName)
      .then((events) => {
        if (!cancelled) {
          setConcerts(events);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch concerts');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [artistName]);

  // Count upcoming shows (within 30 days)
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const upcomingCount = concerts.filter(
    (c) => c.date >= now && c.date <= thirtyDaysFromNow
  ).length;

  return {
    concerts,
    isLoading,
    error,
    upcomingCount,
  };
}
