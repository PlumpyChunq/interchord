'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useArtistRelationships } from '@/lib/musicbrainz/hooks';
import { useEnrichedArtist } from '@/lib/apple-music';
import { Button } from '@/components/ui/button';
import { GraphView, LayoutType, GraphFilters, getDefaultFilters, type GraphFilterState } from '@/components/graph';
import { addToFavorites, removeFromFavorites, isFavorite, enrichFavoriteGenres } from '@/lib/favorites';
import { SidebarSections } from '@/components/sidebar-sections';
import type { ArtistNode } from '@/types';
import { useArtistTimeline } from '@/lib/timeline';
import { ArtistTimeline, TIMELINE_DEFAULT_HEIGHT } from '@/components/timeline';
import { useArtistBio } from '@/lib/wikipedia';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import {
  useGraphExpansion,
  groupRelationshipsByType,
  getRelationshipLabel,
  extractInstruments,
  expansionDepthLabels,
  type ExpansionDepth,
} from '@/lib/graph';

interface ArtistDetailProps {
  artist: ArtistNode;
  onBack: () => void;
  onSelectRelated: (artist: ArtistNode) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- onBack kept for future back navigation
export function ArtistDetail({ artist, onBack, onSelectRelated }: ArtistDetailProps) {
  // UI-only state
  const [showList, setShowList] = useState(true);
  const [isFav, setIsFav] = useState(false);
  const [layoutType, setLayoutType] = useState<LayoutType>('auto');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredArtistId, setHoveredArtistId] = useState<string | null>(null);
  const [graphFilters, setGraphFilters] = useState<GraphFilterState>(getDefaultFilters);
  const [highlightedAlbum, setHighlightedAlbum] = useState<{ name: string; year: number; source: 'timeline' | 'sidebar' } | null>(null);
  const [timelineHeight, setTimelineHeight] = useState(TIMELINE_DEFAULT_HEIGHT);

  // Focused artist - which artist's info (header, albums, timeline) to display
  // Defaults to the original artist, but can be changed via right-click "Focus on this artist"
  // Uses lazy initializer with artist.id as key to auto-reset when artist prop changes
  const [focusedArtist, setFocusedArtist] = useState<ArtistNode>(() => artist);
  const [focusedArtistKey, setFocusedArtistKey] = useState(artist.id);

  // Reset focused artist when the main artist prop changes (new search)
  // This pattern avoids useEffect while still detecting prop changes
  const effectiveFocusedArtist = artist.id !== focusedArtistKey ? artist : focusedArtist;
  if (artist.id !== focusedArtistKey) {
    setFocusedArtistKey(artist.id);
    setFocusedArtist(artist);
  }

  // Sync favorite state when focused artist changes (useSyncExternalStore pattern alternative)
  const currentIsFav = isFavorite(effectiveFocusedArtist.id);
  if (currentIsFav !== isFav) {
    setIsFav(currentIsFav);
  }

  const handleToggleFavorite = useCallback(() => {
    if (isFav) {
      removeFromFavorites(effectiveFocusedArtist.id);
      setIsFav(false);
    } else {
      addToFavorites(effectiveFocusedArtist);
      setIsFav(true);
    }
  }, [effectiveFocusedArtist, isFav]);

  // Graph data uses the original artist (root of the graph)
  const { data, isLoading, error } = useArtistRelationships(artist.id);

  // Focused artist relationships (for sidebar info when viewing a different artist)
  const { data: focusedData } = useArtistRelationships(
    effectiveFocusedArtist.id !== artist.id ? effectiveFocusedArtist.id : ''
  );

  // Graph expansion hook - manages all graph state
  const {
    graphData,
    isExpanding,
    expandProgress,
    expansionDepth,
    availableRelTypes,
    supplementaryFounders,
    handleDepthChange,
    handleNodeExpand,
    handleResetGraph,
    hasExpandedGraph,
  } = useGraphExpansion(artist.id, data);

  // Enrich favorite with genres when artist data is loaded
  // This updates the stored favorite to include genre categories from MusicBrainz tags
  useEffect(() => {
    if (data?.artist?.genres && data.artist.genres.length > 0) {
      enrichFavoriteGenres(data.artist.id, data.artist.genres);
    }
    // Also enrich focused artist if different from main artist
    if (focusedData?.artist?.genres && focusedData.artist.genres.length > 0) {
      enrichFavoriteGenres(focusedData.artist.id, focusedData.artist.genres);
    }
  }, [data?.artist?.id, data?.artist?.genres, focusedData?.artist?.id, focusedData?.artist?.genres]);

  // Enrich focused artist with Apple Music data (image, albums)
  const { data: enrichedArtist } = useEnrichedArtist(effectiveFocusedArtist);
  const displayArtist = enrichedArtist || effectiveFocusedArtist;

  // Fetch focused artist bio from Wikipedia
  const { bio, wikipediaUrl, isLoading: isBioLoading } = useArtistBio({
    artistName: effectiveFocusedArtist.name,
  });

  // Use focused artist data for timeline/sidebar, fall back to root artist data
  const timelineSourceData = focusedData || data;

  // Build map of related artists for timeline
  const relatedArtistsMap = useMemo(() => {
    if (!timelineSourceData) return new Map<string, ArtistNode>();
    return new Map(timelineSourceData.relatedArtists.map(a => [a.id, a]));
  }, [timelineSourceData]);

  // Timeline data for the focused artist
  const {
    events: timelineEvents,
    isLoading: isTimelineLoading,
    yearRange,
  } = useArtistTimeline({
    artist: timelineSourceData?.artist || effectiveFocusedArtist,
    relationships: timelineSourceData?.relationships || [],
    relatedArtists: relatedArtistsMap,
  });

  // Handle highlighting artists from timeline click (selection)
  const handleTimelineHighlight = useCallback((artistIds: string[]) => {
    // Set the first related artist as selected in the graph
    if (artistIds.length > 0) {
      setSelectedNodeId(artistIds[0]);
    } else {
      setSelectedNodeId(null);
    }
  }, []);

  // Handle highlighting artists from timeline hover (bi-directional highlighting)
  const handleTimelineHover = useCallback((artistIds: string[]) => {
    // Set the first related artist as hovered (for graph and sidebar highlighting)
    if (artistIds.length > 0) {
      setHoveredArtistId(artistIds[0]);
    } else {
      setHoveredArtistId(null);
    }
  }, []);

  // Handle highlighting album (from timeline or sidebar)
  const onHighlightAlbum = useCallback((albumName: string | null, year: number | null, source: 'timeline' | 'sidebar' = 'sidebar') => {
    if (albumName && year) {
      setHighlightedAlbum({ name: albumName, year, source });
    } else {
      setHighlightedAlbum(null);
    }
  }, []);

  // Handle node click - select/highlight that node in the graph
  const handleNodeClick = useCallback((clickedArtist: ArtistNode | null) => {
    // If null (background click), clear selection
    if (!clickedArtist) {
      setSelectedNodeId(null);
      return;
    }
    // Toggle selection: if already selected, deselect; otherwise select
    setSelectedNodeId(prev => prev === clickedArtist.id ? null : clickedArtist.id);
  }, []);

  // Handle sidebar click - select node in graph (single click)
  const handleSidebarNodeSelect = useCallback((relatedArtist: ArtistNode) => {
    setSelectedNodeId(prev => prev === relatedArtist.id ? null : relatedArtist.id);
  }, []);

  // Handle sidebar double-click - navigate to that artist
  const handleSidebarNodeNavigate = useCallback((relatedArtist: ArtistNode) => {
    onSelectRelated(relatedArtist);
  }, [onSelectRelated]);

  return (
    <div className="w-full px-4 flex flex-col h-[calc(100vh-80px)]" style={{ paddingBottom: timelineHeight + 16 }}>
      {/* Artist Header - Compact */}
      <div className="flex items-center gap-4 bg-white p-3 rounded-lg border shrink-0 mb-4">
        {/* Left: Image, Star, Name */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Artist Image from Apple Music */}
          {displayArtist.imageUrl ? (
            <img
              src={displayArtist.imageUrl}
              alt={displayArtist.name}
              className="w-14 h-14 rounded-lg object-cover shadow-sm"
            />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          )}
          <button
            onClick={handleToggleFavorite}
            className={`text-xl transition-colors ${
              isFav ? 'text-amber-500' : 'text-gray-300 hover:text-amber-400'
            }`}
            title={isFav ? 'Remove from favorites' : 'Add to favorites'}
          >
            {isFav ? '★' : '☆'}
          </button>
          <div>
            <h1 className="text-xl font-bold">{displayArtist.name}</h1>
            {displayArtist.disambiguation && (
              <p className="text-sm text-gray-500">{displayArtist.disambiguation}</p>
            )}
          </div>
        </div>

        {/* Center: Bio */}
        <div className="flex-1 min-w-0 px-4">
          {isBioLoading ? (
            <p className="text-sm text-gray-400 italic">Loading bio...</p>
          ) : bio ? (
            <p className="text-sm text-gray-600 line-clamp-4">
              {bio}
              {wikipediaUrl && (
                <a
                  href={wikipediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-700 ml-1"
                >
                  Wikipedia
                </a>
              )}
            </p>
          ) : null}
        </div>

        {/* Right: Badges */}
        <div className="flex items-center gap-2 text-sm shrink-0">
          {displayArtist.activeYears?.begin && (
            <span className="text-gray-500">
              {displayArtist.activeYears.begin}{displayArtist.activeYears.end ? `–${displayArtist.activeYears.end}` : '–present'}
            </span>
          )}
          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">
            {displayArtist.type}
          </span>
          {displayArtist.country && (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded-full">
              {displayArtist.country}
            </span>
          )}
        </div>
      </div>

      {/* Controls Bar */}
      <div className="bg-white p-2 rounded-lg border space-y-2 shrink-0 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-base font-semibold">Relationships</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-sm text-gray-600">Network Depth:</label>
            <select
              value={expansionDepth}
              onChange={(e) => handleDepthChange(Number(e.target.value) as ExpansionDepth)}
              disabled={isExpanding}
              className="text-sm border border-gray-300 rounded px-2 py-1 bg-white disabled:opacity-50"
              title={expansionDepthLabels[expansionDepth]}
            >
              <option value={1}>1 - Direct</option>
              <option value={2}>2 - Members&apos; bands</option>
              <option value={3}>3 - Extended</option>
              <option value={4}>4 - Full network</option>
            </select>
            <span className="text-gray-300">|</span>
            <label className="text-sm text-gray-600">Layout:</label>
            <select
              value={layoutType}
              onChange={(e) => setLayoutType(e.target.value as LayoutType)}
              disabled={isExpanding}
              className="text-sm border border-gray-300 rounded px-2 py-1 bg-white disabled:opacity-50"
            >
              <option value="auto">Auto</option>
              <option value="spoke">Spoke</option>
              <option value="radial">Radial</option>
              <option value="force">Force</option>
              <option value="hierarchical">Tree</option>
              <option value="concentric">Concentric</option>
            </select>
            {hasExpandedGraph && (
              <>
                <span className="text-gray-300">|</span>
                <Button variant="outline" size="sm" onClick={handleResetGraph} disabled={isExpanding}>
                  Reset Graph
                </Button>
              </>
            )}
            <Button
              variant={showList ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowList(!showList)}
            >
              {showList ? 'Hide List' : 'Show List'}
            </Button>
          </div>
        </div>
        <div className="border-t pt-2">
          <GraphFilters
            filters={graphFilters}
            onFiltersChange={setGraphFilters}
            availableTypes={availableRelTypes as import('@/types').RelationshipType[]}
            availableYearRange={yearRange}
            compact
          />
        </div>
      </div>

      {isLoading && (
        <div className="p-8 text-center text-gray-500">
          <div className="animate-pulse">Loading relationships...</div>
          <p className="text-sm mt-2">This may take a moment due to rate limiting</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          Error loading relationships: {error.message}
        </div>
      )}

      {data && data.relationships.length === 0 && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-gray-600">
          No artist relationships found in MusicBrainz.
        </div>
      )}

      {data && data.relationships.length > 0 && (
        <ResizablePanelGroup
          direction="horizontal"
          className="rounded-lg flex-1 min-h-0"
        >
          {/* Main Graph View */}
          <ResizablePanel defaultSize={showList ? 70 : 100} minSize={40}>
            <div className="relative h-full">
              {isExpanding && (
                <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center rounded-lg">
                  <div className="bg-white px-4 py-3 rounded-lg shadow-lg text-center">
                    <div className="animate-pulse mb-1">
                      Expanding network to Level {expansionDepth}...
                    </div>
                    {expandProgress && (
                      <div className="text-sm text-gray-500">
                        Node {expandProgress.current} of {expandProgress.total}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <GraphView
                graph={graphData}
                onNodeClick={handleNodeClick}
                onNodeExpand={handleNodeExpand}
                onNodeHover={setHoveredArtistId}
                onFocusArtist={setFocusedArtist}
                selectedNodeId={selectedNodeId}
                hoveredNodeId={hoveredArtistId}
                layoutType={layoutType}
                networkDepth={expansionDepth}
                onLayoutChange={setLayoutType}
                filters={graphFilters}
              />
              <div className="mt-2 text-center text-sm text-gray-500">
                {graphData.nodes.length} artists • {graphData.edges.length} connections
              </div>
            </div>
          </ResizablePanel>

          {/* Resizable Handle */}
          {showList && <ResizableHandle withHandle />}

          {/* List Sidebar */}
          {showList && (
            <ResizablePanel defaultSize={30} minSize={15} maxSize={50}>
              <div className="h-full overflow-y-auto space-y-2 pl-2">
                <SidebarSections
                  artist={artist}
                  displayArtist={displayArtist}
                  relationshipGroups={groupRelationshipsByType(
                    data.relationships,
                    data.relatedArtists,
                    data.artist.activeYears?.begin,
                    supplementaryFounders
                  )}
                  graphFilters={graphFilters}
                  selectedNodeId={selectedNodeId}
                  hoveredArtistId={hoveredArtistId}
                  timelineEvents={timelineEvents}
                  highlightedAlbum={highlightedAlbum}
                  relatedArtists={data.relatedArtists}
                  onSidebarNodeSelect={handleSidebarNodeSelect}
                  onSidebarNodeNavigate={handleSidebarNodeNavigate}
                  onHoverArtist={setHoveredArtistId}
                  onHighlightAlbum={onHighlightAlbum}
                  getRelationshipLabel={getRelationshipLabel}
                  extractInstruments={extractInstruments}
                />
              </div>
            </ResizablePanel>
          )}
        </ResizablePanelGroup>
      )}

      {/* Timeline Ribbon - fixed position, height managed by timeline component */}
      <ArtistTimeline
        events={timelineEvents}
        isLoading={isTimelineLoading}
        yearRange={yearRange}
        onHighlightArtists={handleTimelineHighlight}
        onHoverArtists={handleTimelineHover}
        onHoverAlbum={onHighlightAlbum}
        highlightedAlbum={highlightedAlbum}
        highlightedArtistIds={hoveredArtistId ? [hoveredArtistId] : undefined}
        onHeightChange={setTimelineHeight}
        filterYearRange={graphFilters.yearRange}
      />
    </div>
  );
}
