'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Loader2, Search, User, Users, Music, Disc, Building2, MapPin, Calendar, FileMusic } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAutocomplete, type AutocompleteSuggestion } from '@/lib/musicbrainz/use-autocomplete';
import type { SearchEntityType } from '@/types';

interface AutocompleteInputProps {
  /** Placeholder text */
  placeholder?: string;
  /** Entity type to search (default: 'artist') */
  entityType?: SearchEntityType;
  /** Called when user selects a result from dropdown */
  onSelect: (result: AutocompleteSuggestion) => void;
  /** Called when user presses Enter or clicks Search (full search) */
  onSearch?: (query: string) => void;
  /** Initial input value */
  initialValue?: string;
  /** Minimum characters to trigger autocomplete */
  minChars?: number;
  /** Auto-focus on mount */
  autoFocus?: boolean;
}

/**
 * Get the appropriate icon for an entity type and result
 */
function getEntityIcon(entityType: SearchEntityType, result?: AutocompleteSuggestion) {
  switch (entityType) {
    case 'artist':
      return result?.type === 'person'
        ? <User className="size-4 text-emerald-600" />
        : <Users className="size-4 text-blue-600" />;
    case 'recording':
      return <Music className="size-4 text-purple-600" />;
    case 'release':
    case 'release-group':
      return <Disc className="size-4 text-amber-600" />;
    case 'work':
      return <FileMusic className="size-4 text-pink-600" />;
    case 'label':
      return <Building2 className="size-4 text-gray-600" />;
    case 'place':
      return <MapPin className="size-4 text-red-600" />;
    case 'event':
      return <Calendar className="size-4 text-cyan-600" />;
    default:
      return <Search className="size-4 text-gray-600" />;
  }
}

/**
 * Format duration from milliseconds to mm:ss
 */
function formatDuration(ms: number | undefined): string {
  if (!ms) return '';
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Get subtitle text for a search result based on entity type
 */
function getResultSubtitle(entityType: SearchEntityType, result: AutocompleteSuggestion): string {
  switch (entityType) {
    case 'artist': {
      const parts: string[] = [];
      if (result.type) parts.push(result.type);
      if (result.country) parts.push(result.country);
      return parts.join(' · ');
    }
    case 'recording': {
      const parts: string[] = [];
      if (result.artistCredit) parts.push(result.artistCredit);
      if (result.releaseTitle) parts.push(result.releaseTitle);
      if (result.duration) parts.push(formatDuration(result.duration));
      return parts.join(' · ');
    }
    case 'release':
    case 'release-group': {
      const parts: string[] = [];
      if (result.artistCredit) parts.push(result.artistCredit);
      if (result.type) parts.push(result.type);
      if (result.date) parts.push(result.date.substring(0, 4));
      return parts.join(' · ');
    }
    case 'work': {
      const parts: string[] = [];
      if (result.artistCredit) parts.push(`Written by ${result.artistCredit}`);
      if (result.type) parts.push(result.type);
      if (result.recordingCount && result.recordingCount > 1) {
        parts.push(`${result.recordingCount} recordings`);
      }
      return parts.join(' · ');
    }
    case 'label': {
      const parts: string[] = [];
      if (result.type) parts.push(result.type);
      if (result.country) parts.push(result.country);
      if (result.foundedYear) parts.push(`Est. ${result.foundedYear}`);
      return parts.join(' · ');
    }
    case 'place': {
      const parts: string[] = [];
      if (result.type) parts.push(result.type);
      if (result.area) parts.push(result.area);
      return parts.join(' · ');
    }
    case 'event': {
      const parts: string[] = [];
      if (result.type) parts.push(result.type);
      if (result.date) parts.push(result.date);
      if (result.place) parts.push(result.place);
      return parts.join(' · ');
    }
    default:
      return '';
  }
}

export function AutocompleteInput({
  placeholder = 'Search for an artist...',
  entityType = 'artist',
  onSelect,
  onSearch,
  initialValue = '',
  minChars = 2,
  autoFocus = false,
}: AutocompleteInputProps) {
  const [inputValue, setInputValue] = useState(initialValue);
  const [isFocused, setIsFocused] = useState(false);
  // Track the input value when dropdown was closed, to know when to reopen
  const [closedAtValue, setClosedAtValue] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { suggestions, isLoading, error, source, latencyMs, entityTypeLabel } = useAutocomplete(inputValue, {
    entityType,
    minChars,
    debounceMs: 250,
    limit: 8,
  });

  // Derive isOpen from state - dropdown shows when:
  // 1. Input has focus
  // 2. We have suggestions OR an error to show
  // 3. Input meets minimum chars
  // 4. Input has changed since we closed the dropdown (or never closed)
  const isOpen = useMemo(() => {
    const wasClosedForThisValue = closedAtValue === inputValue;
    return (
      isFocused &&
      !wasClosedForThisValue &&
      (suggestions.length > 0 || error) &&
      inputValue.length >= minChars
    );
  }, [isFocused, closedAtValue, inputValue, suggestions.length, error, minChars]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (result: AutocompleteSuggestion) => {
      setInputValue(result.name);
      setClosedAtValue(result.name);
      onSelect(result);
    },
    [onSelect]
  );

  const handleSearch = useCallback(() => {
    if (inputValue.trim().length >= minChars) {
      setClosedAtValue(inputValue);
      onSearch?.(inputValue.trim());
    }
  }, [inputValue, minChars, onSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'Enter') {
        handleSearch();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0) {
          handleSelect(suggestions[highlightedIndex]);
        } else {
          handleSearch();
        }
        break;
      case 'Escape':
        setClosedAtValue(inputValue);
        setHighlightedIndex(-1);
        break;
      case 'Tab':
        setClosedAtValue(inputValue);
        break;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setHighlightedIndex(-1);
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setIsFocused(true);
            // Clear the closed state so dropdown can reopen
            setClosedAtValue(null);
          }}
          onBlur={() => {
            // Delay blur to allow click on dropdown items
            setTimeout(() => setIsFocused(false), 150);
          }}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="pr-10"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : (
            <Search
              className="size-4 text-muted-foreground cursor-pointer hover:text-foreground"
              onClick={handleSearch}
            />
          )}
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (suggestions.length > 0 || error) && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg overflow-hidden"
        >
          {/* Error message */}
          {error && suggestions.length === 0 && (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
              <p>{error}</p>
              {entityType !== 'artist' && (
                <p className="text-xs mt-1">Try searching for Artists instead</p>
              )}
            </div>
          )}

          <ul className="py-1 max-h-[320px] overflow-y-auto">
            {suggestions.map((result, index) => (
              <li key={result.id}>
                <button
                  type="button"
                  className={`w-full px-3 py-2 text-left flex items-center gap-3 transition-colors ${
                    index === highlightedIndex
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  {/* Icon based on entity type */}
                  <div className="flex-shrink-0">
                    {getEntityIcon(entityType, result)}
                  </div>

                  {/* Result info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{result.name}</span>
                      {result.disambiguation && (
                        <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                          ({result.disambiguation})
                        </span>
                      )}
                    </div>
                    {/* Subtitle based on entity type */}
                    {(() => {
                      const subtitle = getResultSubtitle(entityType, result);
                      if (subtitle) {
                        return (
                          <p className="text-xs text-muted-foreground truncate">
                            {subtitle}
                          </p>
                        );
                      }
                      // Fallback for artist active years
                      if (entityType === 'artist' && result.activeYears?.begin) {
                        return (
                          <p className="text-xs text-muted-foreground">
                            {result.activeYears.begin}
                            {result.activeYears.end
                              ? `–${result.activeYears.end}`
                              : '–present'}
                          </p>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  {/* Country badge (for artists and labels) */}
                  {(entityType === 'artist' || entityType === 'label') && result.country && (
                    <span className="flex-shrink-0 px-1.5 py-0.5 bg-muted rounded text-xs text-muted-foreground">
                      {result.country}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>

          {/* Footer with source info */}
          <div className="px-3 py-1.5 bg-muted/50 border-t border-border text-xs text-muted-foreground flex justify-between">
            <span>
              {suggestions.length} {entityTypeLabel.toLowerCase()}
            </span>
            {latencyMs !== null && (
              <span>
                {source === 'solr' ? 'Solr' : source === 'postgres' ? 'DB' : 'API'}{' '}
                · {latencyMs}ms
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
