'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { useSidebarPreferences, type SectionId } from '@/lib/sidebar';
import { RecentConcerts } from '@/components/recent-concerts';
import type { ArtistNode, ArtistRelationship, TimelineEvent } from '@/types';
import type { GraphFilterState } from '@/components/graph';
import { parseYear } from '@/lib/utils';

interface GroupedItem {
  relationship: ArtistRelationship;
  artist: ArtistNode;
  isFoundingMember: boolean;
  isCurrent: boolean;
  tenure: string;
  sortYear: number;
}

interface Album {
  id: string;
  name: string;
  releaseDate?: string;
  artworkUrl?: string;
}

interface SidebarSectionsProps {
  artist: ArtistNode;
  displayArtist: ArtistNode & { albums?: Album[] };
  relationshipGroups: Map<string, GroupedItem[]>;
  graphFilters: GraphFilterState;
  selectedNodeId: string | null;
  hoveredArtistId: string | null;
  timelineEvents?: TimelineEvent[];
  highlightedAlbum?: { name: string; year: number } | null;
  onSidebarNodeSelect: (artist: ArtistNode) => void;
  onSidebarNodeNavigate: (artist: ArtistNode) => void;
  onHoverArtist: (artistId: string | null) => void;
  onHighlightAlbum: (albumName: string | null, year: number | null) => void;
  getRelationshipLabel: (type: string, artistType: string) => string;
  extractInstruments: (attributes?: string[]) => string[];
}

export function SidebarSections({
  artist,
  displayArtist,
  relationshipGroups,
  graphFilters,
  selectedNodeId,
  hoveredArtistId,
  timelineEvents = [],
  highlightedAlbum,
  onSidebarNodeSelect,
  onSidebarNodeNavigate,
  onHoverArtist,
  onHighlightAlbum,
  getRelationshipLabel,
  extractInstruments,
}: SidebarSectionsProps) {
  const sidebarPrefs = useSidebarPreferences();
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  // Build a lookup from album name (normalized) to year from timeline events
  const albumYearLookup = useMemo(() => {
    const lookup = new Map<string, number>();
    for (const event of timelineEvents) {
      if (event.type === 'album' && event.title) {
        // Normalize album name for matching
        const normalized = event.title.toLowerCase().trim();
        lookup.set(normalized, event.year);
      }
    }
    return lookup;
  }, [timelineEvents]);

  // Helper to find year for an album (fuzzy match)
  const findAlbumYear = useCallback((albumName: string): number | null => {
    const normalized = albumName.toLowerCase().trim();
    // Exact match first
    if (albumYearLookup.has(normalized)) {
      return albumYearLookup.get(normalized)!;
    }
    // Partial match (album name contains or is contained by timeline title)
    for (const [title, year] of albumYearLookup) {
      if (title.includes(normalized) || normalized.includes(title)) {
        return year;
      }
    }
    return null;
  }, [albumYearLookup]);

  // Check if album matches highlighted album (for bidirectional highlighting)
  const isAlbumHighlighted = useCallback((albumName: string, albumYear: number | null): boolean => {
    if (!highlightedAlbum) return false;
    const normalizedAlbum = albumName.toLowerCase().trim();
    const normalizedHighlighted = highlightedAlbum.name.toLowerCase().trim();
    // Match by name similarity and optionally year
    const nameMatches = normalizedAlbum.includes(normalizedHighlighted.substring(0, 10)) ||
                       normalizedHighlighted.includes(normalizedAlbum.substring(0, 10));
    const yearMatches = !albumYear || !highlightedAlbum.year || albumYear === highlightedAlbum.year;
    return nameMatches && yearMatches;
  }, [highlightedAlbum]);

  // Helper to check if a relationship is within the year range
  const isRelationshipInYearRange = useCallback((period: { begin?: string; end?: string | null } | undefined): boolean => {
    if (!graphFilters.yearRange) return true;
    const { min: filterMin, max: filterMax } = graphFilters.yearRange;
    const beginYear = parseYear(period?.begin);
    const endYear = parseYear(period?.end);
    if (beginYear && beginYear > filterMax) return false;
    if (endYear && endYear < filterMin) return false;
    return true;
  }, [graphFilters.yearRange]);

  // Helper to render relationship items
  const renderRelationshipItems = useCallback((items: GroupedItem[]) => (
    <div className="space-y-1">
      {items.map(({ relationship, artist: relatedArtist, isFoundingMember: founding, isCurrent, tenure }) => {
        const isInYearRange = isRelationshipInYearRange(relationship.period);

        return (
          <div
            key={relationship.id}
            className={`flex items-center justify-between py-1 px-2 rounded cursor-pointer transition-all ${
              selectedNodeId === relatedArtist.id
                ? 'bg-orange-100 hover:bg-orange-200'
                : hoveredArtistId === relatedArtist.id
                ? 'bg-purple-50'
                : 'hover:bg-gray-50'
            } ${isInYearRange ? '' : 'opacity-30'}`}
            onClick={() => onSidebarNodeSelect(relatedArtist)}
            onDoubleClick={() => onSidebarNodeNavigate(relatedArtist)}
            onMouseEnter={() => onHoverArtist(relatedArtist.id)}
            onMouseLeave={() => onHoverArtist(null)}
            title="Click to highlight in graph, double-click to navigate"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="font-medium truncate">{relatedArtist.name}</span>
                {founding && (
                  <span className="px-1 py-0.5 bg-amber-100 text-amber-800 rounded text-xs">F</span>
                )}
                {isCurrent && (
                  <span className="px-1 py-0.5 bg-green-100 text-green-800 rounded text-xs">C</span>
                )}
              </div>
              <p className="text-xs text-gray-400 truncate">
                {relationship.attributes && extractInstruments(relationship.attributes).length > 0
                  ? extractInstruments(relationship.attributes).join(', ')
                  : '—'}
              </p>
            </div>
            {tenure && (
              <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{tenure}</span>
            )}
          </div>
        );
      })}
    </div>
  ), [selectedNodeId, hoveredArtistId, onSidebarNodeSelect, onSidebarNodeNavigate, onHoverArtist, extractInstruments, isRelationshipInYearRange]);

  // Ref for album container to enable scrolling
  const albumsContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to highlighted album when selected from timeline
  useEffect(() => {
    if (!highlightedAlbum || !albumsContainerRef.current) return;

    // Find the highlighted album element by data attribute
    const highlightedEl = albumsContainerRef.current.querySelector('[data-album-highlighted="true"]');
    if (highlightedEl) {
      highlightedEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedAlbum]);

  // Helper to render albums
  const renderAlbums = useCallback(() => {
    if (!displayArtist.albums) return null;

    const MAX_ALBUMS = 50;

    // Enrich albums with years from timeline events and sort chronologically
    const albumsWithYears = displayArtist.albums.map(album => {
      // Try releaseDate first, then lookup from timeline events
      const year = parseYear(album.releaseDate) ?? findAlbumYear(album.name);
      return { album, year };
    });

    // Sort by year (albums without years go at the end)
    const sortedAlbums = albumsWithYears.sort((a, b) => {
      if (a.year === null && b.year === null) return 0;
      if (a.year === null) return 1;
      if (b.year === null) return -1;
      return a.year - b.year;
    });

    const displayedAlbums = sortedAlbums.slice(0, MAX_ALBUMS);
    const hasMore = sortedAlbums.length > MAX_ALBUMS;

    return (
      <div className="space-y-2" ref={albumsContainerRef}>
        <div className="grid grid-cols-3 gap-2">
          {displayedAlbums.map(({ album, year: albumYear }) => {
            const musicUrl = `https://music.youtube.com/search?q=${encodeURIComponent(`${displayArtist.name} ${album.name}`)}`;
            const isAlbumInRange = !graphFilters.yearRange || !albumYear ||
              (albumYear >= graphFilters.yearRange.min && albumYear <= graphFilters.yearRange.max);
            const isHighlighted = isAlbumHighlighted(album.name, albumYear);

            return (
              <a
                key={album.id}
                href={musicUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-album-highlighted={isHighlighted ? 'true' : 'false'}
                className={`text-center group cursor-pointer block transition-all ${isAlbumInRange ? '' : 'opacity-30'} ${isHighlighted ? 'ring-4 ring-yellow-400 rounded' : ''}`}
                onMouseEnter={() => albumYear && onHighlightAlbum(album.name, albumYear)}
                onMouseLeave={() => onHighlightAlbum(null, null)}
              >
                {album.artworkUrl ? (
                  <img
                    src={album.artworkUrl}
                    alt={album.name}
                    className={`w-full aspect-square rounded shadow-sm object-cover transition-all ${isHighlighted ? 'ring-4 ring-yellow-400' : 'group-hover:ring-2 group-hover:ring-blue-400'}`}
                  />
                ) : (
                  <div className={`w-full aspect-square rounded bg-gray-100 flex items-center justify-center transition-all ${isHighlighted ? 'ring-4 ring-yellow-400' : 'group-hover:ring-2 group-hover:ring-blue-400'}`}>
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                )}
                <p className={`text-xs mt-1 truncate ${isHighlighted ? 'text-yellow-600 font-medium' : 'group-hover:text-blue-600'}`} title={album.name}>{album.name}</p>
                {albumYear && <p className="text-xs text-gray-400">{albumYear}</p>}
              </a>
            );
          })}
        </div>
        {hasMore && (
          <p className="text-xs text-gray-500 text-center italic">
            +{sortedAlbums.length - MAX_ALBUMS} more albums not shown
          </p>
        )}
      </div>
    );
  }, [displayArtist.albums, displayArtist.name, graphFilters.yearRange, onHighlightAlbum, findAlbumYear, isAlbumHighlighted]);

  // Build sections array with content
  type SectionData = { id: SectionId; title: string; count?: number; content: React.ReactNode };
  const allSections: SectionData[] = [];

  // Add relationship sections
  for (const [type, items] of relationshipGroups) {
    allSections.push({
      id: type as SectionId,
      title: getRelationshipLabel(type, artist.type),
      count: items.length,
      content: renderRelationshipItems(items),
    });
  }

  // Add albums section
  if (displayArtist.albums && displayArtist.albums.length > 0) {
    allSections.push({
      id: 'albums',
      title: 'Albums',
      count: displayArtist.albums.length,
      content: renderAlbums(),
    });
  }

  // Add shows section
  allSections.push({
    id: 'shows',
    title: 'Recent Shows',
    content: <RecentConcerts artistName={artist.name} mbid={artist.id} maxDisplay={5} />,
  });

  // Sort by user preferences order
  const sectionMap = new Map(allSections.map(s => [s.id, s]));
  const orderedSections = sidebarPrefs.order
    .filter(id => sectionMap.has(id))
    .map(id => sectionMap.get(id)!);

  // Add any sections not in the order (new types)
  for (const section of allSections) {
    if (!sidebarPrefs.order.includes(section.id)) {
      orderedSections.push(section);
    }
  }

  // Drag handlers - use section IDs for reliable reordering
  const handleDragStart = (index: number) => setDraggingIndex(index);
  const handleDrop = (fromIndex: number, toIndex: number, position: 'above' | 'below') => {
    const fromSection = orderedSections[fromIndex];
    const toSection = orderedSections[toIndex];
    if (fromSection && toSection && fromSection.id !== toSection.id) {
      sidebarPrefs.reorder(fromSection.id, toSection.id, position);
    }
    setDraggingIndex(null);
  };
  const handleDragEnd = () => setDraggingIndex(null);

  return (
    <>
      {orderedSections.map((section, index) => (
        <CollapsibleSection
          key={section.id}
          id={section.id}
          title={section.title}
          count={section.count}
          isCollapsed={sidebarPrefs.isCollapsed(section.id)}
          onToggle={() => sidebarPrefs.toggle(section.id)}
          onMoveUp={() => sidebarPrefs.moveUp(section.id)}
          onMoveDown={() => sidebarPrefs.moveDown(section.id)}
          canMoveUp={index > 0}
          canMoveDown={index < orderedSections.length - 1}
          index={index}
          onDragStart={handleDragStart}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
          isDragging={draggingIndex === index}
        >
          {section.content}
        </CollapsibleSection>
      ))}
    </>
  );
}
