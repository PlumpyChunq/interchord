/**
 * Autocomplete Hook
 *
 * Provides debounced autocomplete functionality for MusicBrainz entity search.
 * Queries the server-side API which uses Solr for fast results.
 * Supports multiple entity types: artist, recording, release, work, label, place, event.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { SearchEntityType } from '@/types';

// Generic result type - all MusicBrainz entities have at least these fields
export interface AutocompleteSuggestion {
  id: string;
  name: string;
  type?: string;
  disambiguation?: string;
  // Artist-specific
  country?: string;
  activeYears?: { begin?: string; end?: string | null };
  // Recording-specific
  artistCredit?: string;
  releaseTitle?: string;
  duration?: number;
  isrc?: string;
  // Release-specific
  date?: string;
  labelName?: string;
  // Work-specific
  iswc?: string;
  recordingCount?: number;
  // Label-specific
  foundedYear?: number;
  // Place-specific
  area?: string;
  address?: string;
  // Event-specific
  place?: string;
}

interface AutocompleteResult {
  suggestions: AutocompleteSuggestion[];
  isLoading: boolean;
  error: string | null;
  source: 'solr' | 'postgres' | 'api' | 'none';
  latencyMs: number | null;
  entityType: SearchEntityType;
  entityTypeLabel: string;
}

interface UseAutocompleteOptions {
  /** Entity type to search (default: 'artist') */
  entityType?: SearchEntityType;
  /** Minimum characters before searching (default: 2) */
  minChars?: number;
  /** Debounce delay in ms (default: 300) */
  debounceMs?: number;
  /** Maximum suggestions to show (default: 8) */
  limit?: number;
  /** Callback when autocomplete starts */
  onSearchStart?: () => void;
  /** Callback when autocomplete completes */
  onSearchComplete?: (results: AutocompleteSuggestion[]) => void;
}

// Entity type labels for display
const ENTITY_TYPE_LABELS: Record<SearchEntityType, string> = {
  artist: 'Artists',
  recording: 'Songs',
  release: 'Albums',
  'release-group': 'Album Groups',
  work: 'Compositions',
  label: 'Labels',
  place: 'Places',
  area: 'Areas',
  event: 'Events',
};

/**
 * Hook for debounced autocomplete across MusicBrainz entity types
 *
 * @param query - Current search input value
 * @param options - Configuration options
 * @returns Autocomplete state and suggestions
 *
 * @example
 * ```tsx
 * const [inputValue, setInputValue] = useState('');
 * const { suggestions, isLoading } = useAutocomplete(inputValue, { entityType: 'recording' });
 *
 * return (
 *   <div>
 *     <input value={inputValue} onChange={e => setInputValue(e.target.value)} />
 *     {suggestions.map(result => (
 *       <div key={result.id}>{result.name}</div>
 *     ))}
 *   </div>
 * );
 * ```
 */
export function useAutocomplete(
  query: string,
  options: UseAutocompleteOptions = {}
): AutocompleteResult & { clearSuggestions: () => void } {
  const {
    entityType = 'artist',
    minChars = 2,
    debounceMs = 300,
    limit = 8,
    onSearchStart,
    onSearchComplete,
  } = options;

  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'solr' | 'postgres' | 'api' | 'none'>('none');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  // Track the latest query and entity type to handle race conditions
  const latestQueryRef = useRef(query);
  const latestEntityTypeRef = useRef(entityType);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    latestQueryRef.current = query;
    latestEntityTypeRef.current = entityType;

    // Clear suggestions if query is too short
    if (!query || query.length < minChars) {
      setSuggestions([]);
      setIsLoading(false);
      setError(null);
      setSource('none');
      setLatencyMs(null);
      return;
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Start loading after debounce
    const timeoutId = setTimeout(async () => {
      // Double-check query hasn't changed during debounce
      if (query !== latestQueryRef.current || entityType !== latestEntityTypeRef.current) return;

      setIsLoading(true);
      setError(null);
      onSearchStart?.();

      abortControllerRef.current = new AbortController();

      try {
        const params = new URLSearchParams({
          q: query,
          type: entityType,
          limit: String(limit),
        });

        // Use unified autocomplete endpoint
        const response = await fetch(`/api/autocomplete?${params}`, {
          signal: abortControllerRef.current.signal,
        });

        // Check if query changed while waiting
        if (query !== latestQueryRef.current || entityType !== latestEntityTypeRef.current) return;

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        // Final check before updating state
        if (query !== latestQueryRef.current || entityType !== latestEntityTypeRef.current) return;

        setSuggestions(data.results || []);
        setSource(data.source || 'none');
        setLatencyMs(data.latencyMs || null);
        setError(data.error || null);
        onSearchComplete?.(data.results || []);
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        // Only update error if query hasn't changed
        if (query === latestQueryRef.current && entityType === latestEntityTypeRef.current) {
          setError(err instanceof Error ? err.message : 'Autocomplete failed');
          setSuggestions([]);
        }
      } finally {
        if (query === latestQueryRef.current && entityType === latestEntityTypeRef.current) {
          setIsLoading(false);
        }
      }
    }, debounceMs);

    return () => {
      clearTimeout(timeoutId);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query, entityType, minChars, debounceMs, limit, onSearchStart, onSearchComplete]);

  // Clear suggestions manually (useful when selecting)
  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setSource('none');
    setLatencyMs(null);
  }, []);

  return {
    suggestions,
    isLoading,
    error,
    source,
    latencyMs,
    entityType,
    entityTypeLabel: ENTITY_TYPE_LABELS[entityType] || entityType,
    clearSuggestions,
  };
}
