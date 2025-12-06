'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { useSidebarPreferences, type SectionId } from '@/lib/sidebar';
import { RecentConcerts } from '@/components/recent-concerts';
import { ArtistBiography } from '@/components/artist-biography';
import { useStreamingPreference } from '@/lib/streaming';
import { StreamingSelector } from '@/components/streaming-selector';
import type { ArtistNode, ArtistRelationship, TimelineEvent } from '@/types';
import type { GraphFilterState } from '@/components/graph';
import { parseYear } from '@/lib/utils';
import { normalizeAlbumTitle } from '@/lib/utils/album';

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
  highlightedAlbum?: { name: string; year: number; source?: 'timeline' | 'sidebar' } | null;
  onSidebarNodeSelect: (artist: ArtistNode) => void;
  onSidebarNodeNavigate: (artist: ArtistNode) => void;
  onHoverArtist: (artistId: string | null) => void;
  onHighlightAlbum: (albumName: string | null, year: number | null, source?: 'timeline' | 'sidebar') => void;
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
  const { serviceInfo: streamingService } = useStreamingPreference();

  // Normalize album name for matching - strip special chars and extra whitespace
  const normalizeForMatch = useCallback((name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation (!?'"-etc.)
      .replace(/\s+/g, ' ')    // Collapse whitespace
      .trim();
  }, []);

  // Build a lookup from album name (normalized) to year from timeline events
  const albumYearLookup = useMemo(() => {
    const lookup = new Map<string, number>();
    for (const event of timelineEvents) {
      if (event.type === 'album' && event.title) {
        const normalized = normalizeForMatch(event.title);
        lookup.set(normalized, event.year);
      }
    }
    return lookup;
  }, [timelineEvents, normalizeForMatch]);

  // Helper to find year for an album (fuzzy match)
  const findAlbumYear = useCallback((albumName: string): number | null => {
    const normalized = normalizeForMatch(albumName);

    // Exact match first
    if (albumYearLookup.has(normalized)) {
      return albumYearLookup.get(normalized)!;
    }

    // Partial match - check if either contains the other
    for (const [title, year] of albumYearLookup) {
      if (title.includes(normalized) || normalized.includes(title)) {
        return year;
      }
    }

    // Fuzzy match - check if first 10 chars match (handles truncated titles)
    const shortName = normalized.slice(0, 10);
    if (shortName.length >= 5) {
      for (const [title, year] of albumYearLookup) {
        if (title.startsWith(shortName) || shortName.startsWith(title.slice(0, 10))) {
          return year;
        }
      }
    }

    return null;
  }, [albumYearLookup, normalizeForMatch]);

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

  // Generate Wikipedia URL for a search term
  const getWikipediaUrl = useCallback((name: string, type?: string) => {
    const suffix = type === 'person' ? ' musician' : type === 'group' ? ' band' : '';
    return `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(name + suffix)}`;
  }, []);

  // Helper to render relationship items
  const renderRelationshipItems = useCallback((items: GroupedItem[]) => (
    <div className="space-y-1">
      {items.map(({ relationship, artist: relatedArtist, isFoundingMember: founding, isCurrent, tenure }) => {
        const isInYearRange = isRelationshipInYearRange(relationship.period);
        const wikiUrl = getWikipediaUrl(relatedArtist.name, relatedArtist.type);

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
                <a
                  href={wikiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-gray-400 hover:text-blue-600 transition-colors"
                  title={`Wikipedia: ${relatedArtist.name}`}
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.09 13.119c-.936 1.932-2.217 4.548-2.853 5.728-.616 1.074-1.127.931-1.532.029-1.406-3.321-4.293-9.144-5.651-12.409-.251-.601-.441-.987-.619-1.139-.181-.15-.554-.24-1.122-.271C.103 5.033 0 4.982 0 4.898v-.455l.052-.045c.924-.005 5.401 0 5.401 0l.051.045v.434c0 .119-.075.176-.225.176l-.564.031c-.485.029-.727.164-.727.436 0 .135.053.33.166.601 1.082 2.646 4.818 10.521 4.818 10.521l.136.046 2.411-4.81-.482-1.067-1.658-3.264s-.318-.654-.428-.872c-.728-1.443-.712-1.518-1.447-1.617-.207-.023-.313-.05-.313-.149v-.468l.06-.045h4.292l.113.037v.451c0 .105-.076.15-.227.15l-.308.047c-.792.061-.661.381-.136 1.422l1.582 3.252 1.758-3.504c.293-.64.233-.801.111-.947-.07-.084-.305-.22-.812-.24l-.201-.021c-.052 0-.098-.015-.145-.051-.045-.031-.067-.076-.067-.129v-.427l.061-.045c1.247-.008 4.043 0 4.043 0l.059.045v.436c0 .121-.059.178-.193.178-.646.03-.782.095-1.023.439-.12.186-.375.589-.646 1.039l-2.301 4.273-.065.135 2.792 5.712.17.048 4.396-10.438c.154-.422.129-.722-.064-.895-.197-.172-.346-.273-.857-.295l-.42-.016c-.061 0-.105-.014-.152-.045-.043-.029-.072-.075-.072-.119v-.436l.059-.045h4.961l.041.045v.437c0 .119-.074.18-.209.18-.648.03-1.127.18-1.443.421-.314.255-.557.616-.736 1.067 0 0-4.043 9.258-5.426 12.339-.525 1.007-1.053.917-1.503-.031-.571-1.171-1.773-3.786-2.646-5.71l.053-.036z"/>
                  </svg>
                </a>
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
              <span className="text-xs text-gray-500 font-medium bg-gray-100 px-1.5 py-0.5 rounded ml-2 flex-shrink-0">{tenure}</span>
            )}
          </div>
        );
      })}
    </div>
  ), [selectedNodeId, hoveredArtistId, onSidebarNodeSelect, onSidebarNodeNavigate, onHoverArtist, extractInstruments, isRelationshipInYearRange, getWikipediaUrl]);

  // Ref for album container to enable scrolling
  const albumsContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to highlighted album when selected from timeline (NOT from sidebar hover)
  useEffect(() => {
    // Only auto-scroll when the highlight came from the timeline, not from sidebar hover
    // This prevents the jittery oscillation when hovering between albums in the sidebar
    if (!highlightedAlbum || !albumsContainerRef.current || highlightedAlbum.source !== 'timeline') return;

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

    // Deduplicate albums by normalized title + year
    const deduped = new Map<string, { album: Album; year: number | null }>();
    for (const item of albumsWithYears) {
      const normalizedTitle = normalizeAlbumTitle(item.album.name);
      const key = `${normalizedTitle}|${item.year ?? 'unknown'}`;
      const existing = deduped.get(key);
      // Keep shorter title (usually cleaner) or one with artwork
      if (!existing ||
          (item.album.artworkUrl && !existing.album.artworkUrl) ||
          item.album.name.length < existing.album.name.length) {
        deduped.set(key, item);
      }
    }
    const dedupedAlbums = Array.from(deduped.values());

    // Sort by year (albums without years go at the end)
    const sortedAlbums = dedupedAlbums.sort((a, b) => {
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
            const musicUrl = streamingService.getAlbumUrl(displayArtist.name, album.name);
            const wikiAlbumUrl = `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(`${album.name} ${displayArtist.name} album`)}`;
            const isAlbumInRange = !graphFilters.yearRange || !albumYear ||
              (albumYear >= graphFilters.yearRange.min && albumYear <= graphFilters.yearRange.max);
            const isHighlighted = isAlbumHighlighted(album.name, albumYear);

            return (
              <div
                key={album.id}
                data-album-highlighted={isHighlighted ? 'true' : 'false'}
                className={`text-center group transition-all ${isAlbumInRange ? '' : 'opacity-30'} ${isHighlighted ? 'ring-4 ring-yellow-400 rounded' : ''}`}
                onMouseEnter={() => albumYear && onHighlightAlbum(album.name, albumYear)}
                onMouseLeave={() => onHighlightAlbum(null, null)}
              >
                <a
                  href={musicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block cursor-pointer"
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
                </a>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <p className={`text-xs truncate ${isHighlighted ? 'text-yellow-600 font-medium' : 'group-hover:text-blue-600'}`} title={album.name}>{album.name}</p>
                  <a
                    href={wikiAlbumUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-blue-600 transition-colors flex-shrink-0"
                    title={`Wikipedia: ${album.name}`}
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12.09 13.119c-.936 1.932-2.217 4.548-2.853 5.728-.616 1.074-1.127.931-1.532.029-1.406-3.321-4.293-9.144-5.651-12.409-.251-.601-.441-.987-.619-1.139-.181-.15-.554-.24-1.122-.271C.103 5.033 0 4.982 0 4.898v-.455l.052-.045c.924-.005 5.401 0 5.401 0l.051.045v.434c0 .119-.075.176-.225.176l-.564.031c-.485.029-.727.164-.727.436 0 .135.053.33.166.601 1.082 2.646 4.818 10.521 4.818 10.521l.136.046 2.411-4.81-.482-1.067-1.658-3.264s-.318-.654-.428-.872c-.728-1.443-.712-1.518-1.447-1.617-.207-.023-.313-.05-.313-.149v-.468l.06-.045h4.292l.113.037v.451c0 .105-.076.15-.227.15l-.308.047c-.792.061-.661.381-.136 1.422l1.582 3.252 1.758-3.504c.293-.64.233-.801.111-.947-.07-.084-.305-.22-.812-.24l-.201-.021c-.052 0-.098-.015-.145-.051-.045-.031-.067-.076-.067-.129v-.427l.061-.045c1.247-.008 4.043 0 4.043 0l.059.045v.436c0 .121-.059.178-.193.178-.646.03-.782.095-1.023.439-.12.186-.375.589-.646 1.039l-2.301 4.273-.065.135 2.792 5.712.17.048 4.396-10.438c.154-.422.129-.722-.064-.895-.197-.172-.346-.273-.857-.295l-.42-.016c-.061 0-.105-.014-.152-.045-.043-.029-.072-.075-.072-.119v-.436l.059-.045h4.961l.041.045v.437c0 .119-.074.18-.209.18-.648.03-1.127.18-1.443.421-.314.255-.557.616-.736 1.067 0 0-4.043 9.258-5.426 12.339-.525 1.007-1.053.917-1.503-.031-.571-1.171-1.773-3.786-2.646-5.71l.053-.036z"/>
                    </svg>
                  </a>
                </div>
                {albumYear && <p className="text-xs text-gray-400">{albumYear}</p>}
              </div>
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
  }, [displayArtist.albums, displayArtist.name, graphFilters.yearRange, onHighlightAlbum, findAlbumYear, isAlbumHighlighted, streamingService]);

  // Build sections array with content
  type SectionData = { id: SectionId; title: string; count?: number; content: React.ReactNode };
  const allSections: SectionData[] = [];

  // Add biography section (only for person artists, not groups)
  if (artist.type === 'person') {
    allSections.push({
      id: 'biography',
      title: 'Biography',
      content: <ArtistBiography mbid={artist.id} artistName={artist.name} />,
    });
  }

  // Add relationship sections
  for (const [type, items] of relationshipGroups) {
    allSections.push({
      id: type as SectionId,
      title: getRelationshipLabel(type, artist.type),
      count: items.length,
      content: renderRelationshipItems(items),
    });
  }

  // Add albums section with streaming selector
  if (displayArtist.albums && displayArtist.albums.length > 0) {
    allSections.push({
      id: 'albums',
      title: 'Albums',
      count: displayArtist.albums.length,
      content: (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Click album to play on:</span>
            <StreamingSelector compact />
          </div>
          {renderAlbums()}
        </div>
      ),
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
