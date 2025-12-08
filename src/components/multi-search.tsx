'use client';

/**
 * Multi-Entity Search Component
 *
 * Provides a search interface that can search across different MusicBrainz
 * entity types: artists, recordings (songs), releases (albums), works, labels, etc.
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { Search, ChevronDown, Music, Disc, User, Building2, MapPin, Globe, Calendar, FileMusic } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  SearchEntityType,
  ArtistNode,
  RecordingNode,
  ReleaseNode,
  ReleaseGroupNode,
  WorkNode,
  LabelNode,
  PlaceNode,
  AreaNode,
  EventNode,
} from '@/types';

// Entity type configuration
interface EntityTypeConfig {
  label: string;
  placeholder: string;
  icon: React.ElementType;
}

const ENTITY_TYPES: Record<SearchEntityType, EntityTypeConfig> = {
  artist: {
    label: 'Artists',
    placeholder: 'Search for an artist (e.g., Butthole Surfers)',
    icon: User,
  },
  recording: {
    label: 'Songs',
    placeholder: 'Search for a song (e.g., Yesterday)',
    icon: Music,
  },
  release: {
    label: 'Albums',
    placeholder: 'Search for an album (e.g., Abbey Road)',
    icon: Disc,
  },
  'release-group': {
    label: 'Album Groups',
    placeholder: 'Search for album groups',
    icon: Disc,
  },
  work: {
    label: 'Songwriters',
    placeholder: 'Search by song title to find who wrote it',
    icon: FileMusic,
  },
  label: {
    label: 'Labels',
    placeholder: 'Search for a record label (e.g., Sub Pop)',
    icon: Building2,
  },
  place: {
    label: 'Places',
    placeholder: 'Search for a venue or studio',
    icon: MapPin,
  },
  area: {
    label: 'Areas',
    placeholder: 'Search for a city, region, or country',
    icon: Globe,
  },
  event: {
    label: 'Events',
    placeholder: 'Search for a concert or festival',
    icon: Calendar,
  },
};

// Result type union
type SearchResult =
  | ArtistNode
  | RecordingNode
  | ReleaseNode
  | ReleaseGroupNode
  | WorkNode
  | LabelNode
  | PlaceNode
  | AreaNode
  | EventNode;

interface MultiSearchProps {
  onArtistSelect?: (artist: ArtistNode) => void;
  onRecordingSelect?: (recording: RecordingNode) => void;
  onReleaseSelect?: (release: ReleaseNode) => void;
  onReleaseGroupSelect?: (releaseGroup: ReleaseGroupNode) => void;
  onWorkSelect?: (work: WorkNode) => void;
  onLabelSelect?: (label: LabelNode) => void;
  onPlaceSelect?: (place: PlaceNode) => void;
  onAreaSelect?: (area: AreaNode) => void;
  onEventSelect?: (event: EventNode) => void;
  defaultEntityType?: SearchEntityType;
  allowedEntityTypes?: SearchEntityType[];
  className?: string;
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
 * Get subtitle text for a search result
 */
function getResultSubtitle(entityType: SearchEntityType, result: SearchResult): string {
  switch (entityType) {
    case 'artist': {
      const artist = result as ArtistNode;
      const parts: string[] = [];
      if (artist.type) parts.push(artist.type);
      if (artist.country) parts.push(artist.country);
      if (artist.disambiguation) parts.push(artist.disambiguation);
      return parts.join(' · ');
    }
    case 'recording': {
      const recording = result as RecordingNode;
      const parts: string[] = [];
      if (recording.artistCredit) parts.push(recording.artistCredit);
      if (recording.releaseTitle) parts.push(recording.releaseTitle);
      if (recording.duration) parts.push(formatDuration(recording.duration));
      return parts.join(' · ');
    }
    case 'release': {
      const release = result as ReleaseNode;
      const parts: string[] = [];
      if (release.artistCredit) parts.push(release.artistCredit);
      if (release.type) parts.push(release.type);
      if (release.date) parts.push(release.date.substring(0, 4));
      return parts.join(' · ');
    }
    case 'release-group': {
      const rg = result as ReleaseGroupNode;
      const parts: string[] = [];
      if (rg.artistCredit) parts.push(rg.artistCredit);
      if (rg.type) parts.push(rg.type);
      if (rg.firstReleaseDate) parts.push(rg.firstReleaseDate.substring(0, 4));
      return parts.join(' · ');
    }
    case 'work': {
      const work = result as WorkNode;
      const parts: string[] = [];
      if (work.artistCredit) parts.push(`Written by ${work.artistCredit}`);
      if (work.type) parts.push(work.type);
      if (work.recordingCount && work.recordingCount > 1) {
        parts.push(`${work.recordingCount} recordings`);
      }
      return parts.join(' · ');
    }
    case 'label': {
      const label = result as LabelNode;
      const parts: string[] = [];
      if (label.type) parts.push(label.type);
      if (label.country) parts.push(label.country);
      if (label.foundedYear) parts.push(`Est. ${label.foundedYear}`);
      return parts.join(' · ');
    }
    case 'place': {
      const place = result as PlaceNode;
      const parts: string[] = [];
      if (place.type) parts.push(place.type);
      if (place.area) parts.push(place.area);
      return parts.join(' · ');
    }
    case 'area': {
      const area = result as AreaNode;
      const parts: string[] = [];
      if (area.type) parts.push(area.type);
      return parts.join(' · ');
    }
    case 'event': {
      const event = result as EventNode;
      const parts: string[] = [];
      if (event.type) parts.push(event.type);
      if (event.date) parts.push(event.date);
      if (event.place) parts.push(event.place);
      return parts.join(' · ');
    }
    default:
      return '';
  }
}

export function MultiSearch({
  onArtistSelect,
  onRecordingSelect,
  onReleaseSelect,
  onReleaseGroupSelect,
  onWorkSelect,
  onLabelSelect,
  onPlaceSelect,
  onAreaSelect,
  onEventSelect,
  defaultEntityType = 'artist',
  allowedEntityTypes,
  className,
}: MultiSearchProps) {
  const [entityType, setEntityType] = useState<SearchEntityType>(defaultEntityType);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [source, setSource] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Filter allowed entity types
  const availableTypes = useMemo(() => {
    const allTypes = Object.keys(ENTITY_TYPES) as SearchEntityType[];
    return allowedEntityTypes ? allTypes.filter((t) => allowedEntityTypes.includes(t)) : allTypes;
  }, [allowedEntityTypes]);

  const currentConfig = ENTITY_TYPES[entityType];
  const Icon = currentConfig.icon;

  // Debounced search
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.length < 2) {
        setResults([]);
        setShowDropdown(false);
        return;
      }

      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setIsLoading(true);

      try {
        const response = await fetch(
          `/api/autocomplete?q=${encodeURIComponent(searchQuery)}&type=${entityType}&limit=10`,
          { signal: abortControllerRef.current.signal }
        );

        if (!response.ok) {
          throw new Error('Search failed');
        }

        const data = await response.json();
        setResults(data.results || []);
        setSource(data.source || null);
        setShowDropdown(true);
        setHighlightedIndex(-1);
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('[MultiSearch] Error:', error);
          setResults([]);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [entityType]
  );

  const handleInputChange = useCallback(
    (value: string) => {
      setQuery(value);

      // Debounce search
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }

      searchTimeout.current = setTimeout(() => {
        performSearch(value);
      }, 200);
    },
    [performSearch]
  );

  const handleResultSelect = useCallback(
    (result: SearchResult) => {
      setShowDropdown(false);
      setQuery('');
      setResults([]);

      switch (entityType) {
        case 'artist':
          onArtistSelect?.(result as ArtistNode);
          break;
        case 'recording':
          onRecordingSelect?.(result as RecordingNode);
          break;
        case 'release':
          onReleaseSelect?.(result as ReleaseNode);
          break;
        case 'release-group':
          onReleaseGroupSelect?.(result as ReleaseGroupNode);
          break;
        case 'work':
          onWorkSelect?.(result as WorkNode);
          break;
        case 'label':
          onLabelSelect?.(result as LabelNode);
          break;
        case 'place':
          onPlaceSelect?.(result as PlaceNode);
          break;
        case 'area':
          onAreaSelect?.(result as AreaNode);
          break;
        case 'event':
          onEventSelect?.(result as EventNode);
          break;
      }
    },
    [
      entityType,
      onArtistSelect,
      onRecordingSelect,
      onReleaseSelect,
      onReleaseGroupSelect,
      onWorkSelect,
      onLabelSelect,
      onPlaceSelect,
      onAreaSelect,
      onEventSelect,
    ]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showDropdown || results.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) => Math.min(prev + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => Math.max(prev - 1, -1));
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < results.length) {
            handleResultSelect(results[highlightedIndex]);
          }
          break;
        case 'Escape':
          setShowDropdown(false);
          break;
      }
    },
    [showDropdown, results, highlightedIndex, handleResultSelect]
  );

  const handleTypeChange = useCallback((newType: SearchEntityType) => {
    setEntityType(newType);
    setShowTypeSelector(false);
    setResults([]);
    setQuery('');
    // Focus input after type change
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  return (
    <div className={cn('relative w-full', className)}>
      <div className="flex gap-2">
        {/* Entity Type Selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowTypeSelector(!showTypeSelector)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg border bg-background',
              'hover:bg-accent transition-colors',
              'text-sm font-medium min-w-[120px] justify-between'
            )}
          >
            <span className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              {currentConfig.label}
            </span>
            <ChevronDown className={cn('h-4 w-4 transition-transform', showTypeSelector && 'rotate-180')} />
          </button>

          {/* Type Dropdown */}
          {showTypeSelector && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-background border rounded-lg shadow-lg z-50">
              {availableTypes.map((type) => {
                const config = ENTITY_TYPES[type];
                const TypeIcon = config.icon;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleTypeChange(type)}
                    className={cn(
                      'flex items-center gap-2 w-full px-3 py-2 text-left text-sm',
                      'hover:bg-accent transition-colors',
                      type === entityType && 'bg-accent/50'
                    )}
                  >
                    <TypeIcon className="h-4 w-4" />
                    {config.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Search Input */}
        <div className="relative flex-1">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => query.length >= 2 && setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              placeholder={currentConfig.placeholder}
              className={cn(
                'w-full pl-10 pr-4 py-2 rounded-lg border bg-background',
                'focus:outline-none focus:ring-2 focus:ring-primary/20',
                'placeholder:text-muted-foreground'
              )}
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            {isLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="h-4 w-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Results Dropdown */}
          {showDropdown && results.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto"
            >
              {results.map((result, index) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => handleResultSelect(result)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={cn(
                    'flex flex-col w-full px-3 py-2 text-left',
                    'hover:bg-accent transition-colors',
                    index === highlightedIndex && 'bg-accent'
                  )}
                >
                  <span className="font-medium">{result.name}</span>
                  <span className="text-sm text-muted-foreground truncate">
                    {getResultSubtitle(entityType, result)}
                  </span>
                </button>
              ))}

              {/* Source indicator */}
              {source && (
                <div className="px-3 py-1 text-xs text-muted-foreground border-t">
                  Source: {source}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Click outside to close type selector */}
      {showTypeSelector && (
        <div className="fixed inset-0 z-40" onClick={() => setShowTypeSelector(false)} />
      )}
    </div>
  );
}
