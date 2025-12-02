'use client';

import { useQuery } from '@tanstack/react-query';
import { searchWikipedia, type WikipediaSummary } from './client';

interface UseArtistBioParams {
  artistName: string | null;
}

interface UseArtistBioResult {
  bio: string | null;
  description: string | null;
  wikipediaUrl: string | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to fetch a brief artist bio from Wikipedia
 */
export function useArtistBio({ artistName }: UseArtistBioParams): UseArtistBioResult {
  const { data, isLoading, error } = useQuery({
    queryKey: ['artistBio', artistName],
    queryFn: async (): Promise<WikipediaSummary | null> => {
      if (!artistName) return null;
      return searchWikipedia(artistName);
    },
    enabled: !!artistName,
    staleTime: 60 * 60 * 1000, // 1 hour - bios don't change often
    retry: false, // Don't retry on 404s
  });

  // Truncate bio to ~400 characters at a sentence boundary (fits 3-4 lines)
  const truncateBio = (text: string | undefined, maxLength = 400): string | null => {
    if (!text) return null;

    if (text.length <= maxLength) return text;

    // Find the last sentence boundary before maxLength
    const truncated = text.slice(0, maxLength);
    const lastPeriod = truncated.lastIndexOf('. ');
    const lastExclamation = truncated.lastIndexOf('! ');
    const lastQuestion = truncated.lastIndexOf('? ');

    const lastSentence = Math.max(lastPeriod, lastExclamation, lastQuestion);

    if (lastSentence > maxLength / 2) {
      return text.slice(0, lastSentence + 1);
    }

    // Fallback: truncate at word boundary
    const lastSpace = truncated.lastIndexOf(' ');
    return text.slice(0, lastSpace) + '...';
  };

  return {
    bio: truncateBio(data?.extract),
    description: data?.description || null,
    wikipediaUrl: data?.content_urls?.desktop?.page || null,
    isLoading,
    error: error as Error | null,
  };
}
