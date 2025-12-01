'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useArtistRelationships } from '@/lib/musicbrainz/hooks';
import { useEnrichedArtist } from '@/lib/apple-music';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GraphView, LayoutType, GraphFilters, getDefaultFilters, type GraphFilterState } from '@/components/graph';
import { addToFavorites, removeFromFavorites, isFavorite } from '@/components/artist-search';
import type { ArtistNode, ArtistRelationship, ArtistGraph } from '@/types';
import { getArtistRelationships } from '@/lib/musicbrainz/client';
import { RecentConcerts } from '@/components/recent-concerts';
import { useArtistTimeline } from '@/lib/timeline';
import { ArtistTimeline, TIMELINE_DEFAULT_HEIGHT } from '@/components/timeline';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';

interface ArtistDetailProps {
  artist: ArtistNode;
  onBack: () => void;
  onSelectRelated: (artist: ArtistNode) => void;
}

// Expansion depth options
type ExpansionDepth = 1 | 2 | 3 | 4;

const expansionDepthLabels: Record<ExpansionDepth, string> = {
  1: 'Level 1 - Direct connections only',
  2: 'Level 2 - Include members\' other bands',
  3: 'Level 3 - Two degrees of separation',
  4: 'Level 4 - Three degrees (large graph)',
};

// Labels for when viewing a band/group
const relationshipLabelsForGroup: Record<string, string> = {
  member_of: 'Members',
  founder_of: 'Founders',
  side_project: 'Side Projects',
  collaboration: 'Collaborations',
  producer: 'Producers',
  influenced_by: 'Influences',
  same_scene: 'Same Scene',
  same_label: 'Same Label',
  touring_member: 'Touring Members',
};

// Labels for when viewing a person
const relationshipLabelsForPerson: Record<string, string> = {
  member_of: 'Bands & Groups',
  founder_of: 'Founded',
  side_project: 'Side Projects',
  collaboration: 'Collaborations',
  producer: 'Produced',
  influenced_by: 'Influences',
  same_scene: 'Same Scene',
  same_label: 'Same Label',
  touring_member: 'Touring For',
};

// Get appropriate labels based on artist type
const getRelationshipLabel = (type: string, artistType: string): string => {
  const labels = artistType === 'person' ? relationshipLabelsForPerson : relationshipLabelsForGroup;
  return labels[type] || type;
};

interface GroupedItem {
  relationship: ArtistRelationship;
  artist: ArtistNode;
  isFoundingMember: boolean;
  isCurrent: boolean;
  tenure: string;
  sortYear: number;
}

// Extract instruments from attributes (filter out non-instrument attributes)
function extractInstruments(attributes?: string[]): string[] {
  if (!attributes) return [];

  const nonInstruments = ['founding', 'original', 'past', 'current', 'minor'];
  return attributes
    .filter(attr => !nonInstruments.some(ni => attr.toLowerCase().includes(ni)))
    .slice(0, 3); // Top 3 instruments
}

function formatTenure(begin?: string, end?: string | null): string {
  if (!begin) return '';
  const startYear = begin.substring(0, 4);
  if (end) {
    const endYear = end.substring(0, 4);
    return startYear === endYear ? startYear : `${startYear}–${endYear}`;
  }
  return `${startYear}–present`;
}

function isFoundingMember(
  rel: ArtistRelationship,
  earliestYear: number
): boolean {
  if (rel.type !== 'member_of') return false;

  const hasFoundingAttribute = rel.attributes?.some(
    attr => attr.toLowerCase().includes('found')
  );
  if (hasFoundingAttribute) return true;

  const startYear = rel.period?.begin ? parseInt(rel.period.begin.substring(0, 4)) : 9999;
  return startYear <= earliestYear + 1;
}

function getEarliestMemberYear(
  relationships: ArtistRelationship[],
  bandStartYear?: string
): number {
  let earliestYear = bandStartYear ? parseInt(bandStartYear.substring(0, 4)) : 9999;

  for (const rel of relationships) {
    if (rel.type === 'member_of' && rel.period?.begin) {
      const year = parseInt(rel.period.begin.substring(0, 4));
      if (year < earliestYear) earliestYear = year;
    }
  }

  return earliestYear;
}

function groupRelationshipsByType(
  relationships: ArtistRelationship[],
  relatedArtists: ArtistNode[],
  bandStartYear?: string
): Map<string, GroupedItem[]> {
  const artistMap = new Map(relatedArtists.map(a => [a.id, a]));
  const grouped = new Map<string, GroupedItem[]>();
  const earliestYear = getEarliestMemberYear(relationships, bandStartYear);

  for (const rel of relationships) {
    const artist = artistMap.get(rel.target) || artistMap.get(rel.source);

    if (artist) {
      const type = rel.type;
      if (!grouped.has(type)) {
        grouped.set(type, []);
      }

      const startYear = rel.period?.begin ? parseInt(rel.period.begin.substring(0, 4)) : 9999;
      const founding = isFoundingMember(rel, earliestYear);
      const isCurrent = !rel.period?.end;
      const tenure = formatTenure(rel.period?.begin, rel.period?.end);

      grouped.get(type)!.push({
        relationship: rel,
        artist,
        isFoundingMember: founding,
        isCurrent,
        tenure,
        sortYear: startYear,
      });
    }
  }

  for (const [, items] of grouped) {
    items.sort((a, b) => {
      if (a.isFoundingMember && !b.isFoundingMember) return -1;
      if (!a.isFoundingMember && b.isFoundingMember) return 1;
      if (a.isCurrent && !b.isCurrent) return -1;
      if (!a.isCurrent && b.isCurrent) return 1;
      return a.sortYear - b.sortYear;
    });
  }

  return grouped;
}

// Build graph data with founding member status and instruments
function buildGraphData(
  centerArtist: ArtistNode,
  relationships: ArtistRelationship[],
  relatedArtists: ArtistNode[],
  bandStartYear?: string
): ArtistGraph {
  const earliestYear = getEarliestMemberYear(relationships, bandStartYear);

  // Create maps for founding status and instruments per artist
  const foundingMap = new Map<string, boolean>();
  const instrumentsMap = new Map<string, string[]>();

  for (const rel of relationships) {
    const relatedId = rel.target !== centerArtist.id ? rel.target : rel.source;
    if (!foundingMap.has(relatedId)) {
      foundingMap.set(relatedId, isFoundingMember(rel, earliestYear));
    }
    // Collect instruments from relationship attributes
    const instruments = extractInstruments(rel.attributes);
    if (instruments.length > 0) {
      const existing = instrumentsMap.get(relatedId) || [];
      instrumentsMap.set(relatedId, [...new Set([...existing, ...instruments])].slice(0, 3));
    }
  }

  const nodes: ArtistGraph['nodes'] = [
    {
      data: {
        ...centerArtist,
        loaded: true,
      },
    },
    ...relatedArtists.map(a => ({
      data: {
        ...a,
        loaded: false,
        founding: foundingMap.get(a.id) || false,
        instruments: instrumentsMap.get(a.id),
      },
    })),
  ];

  const edges: ArtistGraph['edges'] = relationships.map(rel => ({
    data: rel,
  }));

  return { nodes, edges };
}

// Merge new graph data into existing graph
function mergeGraphData(
  existingGraph: ArtistGraph,
  newNodes: ArtistGraph['nodes'],
  newEdges: ArtistGraph['edges'],
  expandedNodeId: string
): ArtistGraph {
  const existingNodeIds = new Set(existingGraph.nodes.map(n => n.data.id));
  const existingEdgeIds = new Set(existingGraph.edges.map(e => e.data.id));

  const updatedNodes = existingGraph.nodes.map(n => {
    if (n.data.id === expandedNodeId) {
      return { ...n, data: { ...n.data, loaded: true } };
    }
    return n;
  });

  for (const node of newNodes) {
    if (!existingNodeIds.has(node.data.id)) {
      updatedNodes.push(node);
    }
  }

  const updatedEdges = [...existingGraph.edges];
  for (const edge of newEdges) {
    if (!existingEdgeIds.has(edge.data.id)) {
      updatedEdges.push(edge);
    }
  }

  return { nodes: updatedNodes, edges: updatedEdges };
}

export function ArtistDetail({ artist, onBack, onSelectRelated }: ArtistDetailProps) {
  const [expandedGraph, setExpandedGraph] = useState<ArtistGraph | null>(null);
  const [isExpanding, setIsExpanding] = useState(false);
  const [expandingNodeId, setExpandingNodeId] = useState<string | null>(null);
  const [autoExpandComplete, setAutoExpandComplete] = useState(false);
  const [expansionDepth, setExpansionDepth] = useState<ExpansionDepth>(1);
  const [expandProgress, setExpandProgress] = useState<{ current: number; total: number } | null>(null);
  const [showList, setShowList] = useState(true);
  const [isFav, setIsFav] = useState(false);
  const [layoutType, setLayoutType] = useState<LayoutType>('auto');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredArtistId, setHoveredArtistId] = useState<string | null>(null);
  const [graphFilters, setGraphFilters] = useState<GraphFilterState>(getDefaultFilters);
  const [highlightedAlbum, setHighlightedAlbum] = useState<{ name: string; year: number } | null>(null);
  const [timelineHeight, setTimelineHeight] = useState(TIMELINE_DEFAULT_HEIGHT);

  // Check if artist is favorite on mount
  useEffect(() => {
    setIsFav(isFavorite(artist.id));
  }, [artist.id]);

  const handleToggleFavorite = useCallback(() => {
    if (isFav) {
      removeFromFavorites(artist.id);
      setIsFav(false);
    } else {
      addToFavorites(artist);
      setIsFav(true);
    }
  }, [artist, isFav]);

  const { data, isLoading, error } = useArtistRelationships(artist.id);

  // Enrich artist with Apple Music data (image, albums)
  const { data: enrichedArtist } = useEnrichedArtist(artist);
  const displayArtist = enrichedArtist || artist;

  // Build map of related artists for timeline
  const relatedArtistsMap = useMemo(() => {
    if (!data) return new Map<string, ArtistNode>();
    return new Map(data.relatedArtists.map(a => [a.id, a]));
  }, [data]);

  // Timeline data
  const {
    events: timelineEvents,
    isLoading: isTimelineLoading,
    yearRange,
  } = useArtistTimeline({
    artist: data?.artist || null,
    relationships: data?.relationships || [],
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

  // Handle highlighting album from sidebar (for timeline)
  const onHighlightAlbum = useCallback((albumName: string | null, year: number | null) => {
    if (albumName && year) {
      setHighlightedAlbum({ name: albumName, year });
    } else {
      setHighlightedAlbum(null);
    }
  }, []);

  // Build initial graph data from relationships
  const initialGraphData = useMemo<ArtistGraph>(() => {
    if (!data) return { nodes: [], edges: [] };
    return buildGraphData(
      data.artist,
      data.relationships,
      data.relatedArtists,
      data.artist.activeYears?.begin
    );
  }, [data]);

  // Use expanded graph if available, otherwise initial
  const graphData = expandedGraph || initialGraphData;

  // Compute available relationship types from current graph edges
  const availableRelTypes = useMemo(() => {
    const types = new Set<string>();
    graphData.edges.forEach(edge => {
      if (edge.data.type) {
        types.add(edge.data.type);
      }
    });
    return Array.from(types);
  }, [graphData.edges]);

  // Multi-level expansion function
  const performMultiLevelExpansion = useCallback(async (depth: ExpansionDepth) => {
    if (!data || isExpanding) return;

    setIsExpanding(true);
    setAutoExpandComplete(true);

    let currentGraph = buildGraphData(
      data.artist,
      data.relationships,
      data.relatedArtists,
      data.artist.activeYears?.begin
    );

    if (depth === 1) {
      setExpandedGraph(currentGraph);
      setIsExpanding(false);
      return;
    }

    const nodeDepths = new Map<string, number>();
    nodeDepths.set(data.artist.id, 0);
    for (const node of currentGraph.nodes) {
      if (!nodeDepths.has(node.data.id)) {
        nodeDepths.set(node.data.id, 1);
      }
    }

    for (let currentLevel = 1; currentLevel < depth; currentLevel++) {
      const nodesToExpand = currentGraph.nodes
        .filter(n =>
          n.data.loaded === false &&
          nodeDepths.get(n.data.id) === currentLevel
        )
        .map(n => n.data);

      if (nodesToExpand.length === 0) break;

      setExpandProgress({ current: 0, total: nodesToExpand.length });

      for (let i = 0; i < nodesToExpand.length; i++) {
        const nodeToExpand = nodesToExpand[i];
        setExpandingNodeId(nodeToExpand.id);
        setExpandProgress({ current: i + 1, total: nodesToExpand.length });

        try {
          const expandedData = await getArtistRelationships(nodeToExpand.id);

          if (expandedData) {
            const newGraph = buildGraphData(
              expandedData.artist,
              expandedData.relationships,
              expandedData.relatedArtists,
              expandedData.artist.activeYears?.begin
            );

            for (const node of newGraph.nodes) {
              if (!nodeDepths.has(node.data.id)) {
                nodeDepths.set(node.data.id, currentLevel + 1);
              }
            }

            currentGraph = mergeGraphData(
              currentGraph,
              newGraph.nodes,
              newGraph.edges,
              nodeToExpand.id
            );
          }
        } catch (err) {
          console.error(`Failed to expand ${nodeToExpand.name}:`, err);
        }
      }
    }

    setExpandedGraph(currentGraph);
    setIsExpanding(false);
    setExpandingNodeId(null);
    setExpandProgress(null);
  }, [data, isExpanding]);

  // Auto-expand when data loads
  useEffect(() => {
    if (!data || autoExpandComplete || isExpanding) return;
    performMultiLevelExpansion(expansionDepth);
  }, [data, autoExpandComplete, isExpanding, expansionDepth, performMultiLevelExpansion]);

  // Handle expansion depth change
  const handleDepthChange = (newDepth: ExpansionDepth) => {
    if (newDepth === expansionDepth || isExpanding) return;
    setExpansionDepth(newDepth);
    setAutoExpandComplete(false);
    setExpandedGraph(null);
  };

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

  // Handle node expansion
  const handleNodeExpand = useCallback(async (nodeId: string) => {
    if (isExpanding) return;

    setIsExpanding(true);
    setExpandingNodeId(nodeId);

    try {
      const expandedData = await getArtistRelationships(nodeId);

      if (expandedData) {
        const newGraph = buildGraphData(
          expandedData.artist,
          expandedData.relationships,
          expandedData.relatedArtists,
          expandedData.artist.activeYears?.begin
        );

        const currentGraph = expandedGraph || initialGraphData;
        const merged = mergeGraphData(
          currentGraph,
          newGraph.nodes,
          newGraph.edges,
          nodeId
        );

        setExpandedGraph(merged);
      }
    } catch (err) {
      console.error('Failed to expand node:', err);
    } finally {
      setIsExpanding(false);
      setExpandingNodeId(null);
    }
  }, [isExpanding, expandedGraph, initialGraphData]);

  // Reset graph
  const handleResetGraph = () => {
    setExpandedGraph(null);
    setAutoExpandComplete(false);
  };

  return (
    <div className="w-full px-4 flex flex-col h-[calc(100vh-80px)]" style={{ paddingBottom: timelineHeight + 16 }}>
      {/* Artist Header - Compact */}
      <div className="flex items-center justify-between bg-white p-3 rounded-lg border shrink-0 mb-4">
        <div className="flex items-center gap-3">
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
            <h1 className="text-xl font-bold">{artist.name}</h1>
            {artist.disambiguation && (
              <p className="text-sm text-gray-500">{artist.disambiguation}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {artist.activeYears?.begin && (
            <span className="text-gray-500">
              {artist.activeYears.begin}{artist.activeYears.end ? `–${artist.activeYears.end}` : '–present'}
            </span>
          )}
          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">
            {artist.type}
          </span>
          {artist.country && (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded-full">
              {artist.country}
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
            {expandedGraph && (
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
              {/* Relationship groups first (Members, Collaborations, Bands & Groups) */}
              {Array.from(
                groupRelationshipsByType(
                  data.relationships,
                  data.relatedArtists,
                  data.artist.activeYears?.begin
                )
              ).map(([type, items]) => (
                <Card key={type} className="text-sm">
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-base">
                      {getRelationshipLabel(type, artist.type)}
                      <span className="ml-1 text-xs font-normal text-gray-500">
                        ({items.length})
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2 px-3">
                    <div className="space-y-1">
                      {items.map(({ relationship, artist: relatedArtist, isFoundingMember: founding, isCurrent, tenure }) => (
                        <div
                          key={relationship.id}
                          className={`flex items-center justify-between py-1 px-2 rounded cursor-pointer transition-colors ${
                            selectedNodeId === relatedArtist.id
                              ? 'bg-orange-100 hover:bg-orange-200'
                              : hoveredArtistId === relatedArtist.id
                              ? 'bg-purple-50'
                              : 'hover:bg-gray-50'
                          }`}
                          onClick={() => handleSidebarNodeSelect(relatedArtist)}
                          onDoubleClick={() => handleSidebarNodeNavigate(relatedArtist)}
                          onMouseEnter={() => setHoveredArtistId(relatedArtist.id)}
                          onMouseLeave={() => setHoveredArtistId(null)}
                          title="Click to highlight in graph, double-click to navigate"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="font-medium truncate">{relatedArtist.name}</span>
                              {founding && (
                                <span className="px-1 py-0.5 bg-amber-100 text-amber-800 rounded text-xs">
                                  F
                                </span>
                              )}
                              {isCurrent && (
                                <span className="px-1 py-0.5 bg-green-100 text-green-800 rounded text-xs">
                                  C
                                </span>
                              )}
                            </div>
                            {relationship.attributes && relationship.attributes.length > 0 && (
                              <p className="text-xs text-gray-500 truncate">
                                {extractInstruments(relationship.attributes).join(', ')}
                              </p>
                            )}
                          </div>
                          {tenure && (
                            <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                              {tenure}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Albums - sorted by year, clickable */}
              {displayArtist.albums && displayArtist.albums.length > 0 && (
                <Card className="text-sm">
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-base">
                      Albums
                      <span className="ml-1 text-xs font-normal text-gray-500">
                        ({displayArtist.albums.length})
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2 px-3">
                    <div className="grid grid-cols-3 gap-2">
                      {[...displayArtist.albums]
                        .sort((a, b) => {
                          const yearA = a.releaseDate ? parseInt(a.releaseDate.substring(0, 4)) : 0;
                          const yearB = b.releaseDate ? parseInt(b.releaseDate.substring(0, 4)) : 0;
                          return yearA - yearB; // Oldest first
                        })
                        .map((album) => {
                          // Generate music service URL - YouTube Music as free fallback
                          const musicUrl = `https://music.youtube.com/search?q=${encodeURIComponent(`${displayArtist.name} ${album.name}`)}`;
                          const albumYear = album.releaseDate ? parseInt(album.releaseDate.substring(0, 4)) : null;

                          return (
                            <a
                              key={album.id}
                              href={musicUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-center group cursor-pointer block"
                              onMouseEnter={() => {
                                // Highlight this album in the timeline
                                if (albumYear && onHighlightAlbum) {
                                  onHighlightAlbum(album.name, albumYear);
                                }
                              }}
                              onMouseLeave={() => {
                                // Clear timeline highlight
                                if (onHighlightAlbum) {
                                  onHighlightAlbum(null, null);
                                }
                              }}
                            >
                              {album.artworkUrl ? (
                                <img
                                  src={album.artworkUrl}
                                  alt={album.name}
                                  className="w-full aspect-square rounded shadow-sm object-cover group-hover:ring-2 group-hover:ring-blue-400 transition-all"
                                />
                              ) : (
                                <div className="w-full aspect-square rounded bg-gray-100 flex items-center justify-center group-hover:ring-2 group-hover:ring-blue-400 transition-all">
                                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                  </svg>
                                </div>
                              )}
                              <p className="text-xs mt-1 truncate group-hover:text-blue-600" title={album.name}>
                                {album.name}
                              </p>
                              {album.releaseDate && (
                                <p className="text-xs text-gray-400">
                                  {album.releaseDate.substring(0, 4)}
                                </p>
                              )}
                            </a>
                          );
                        })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recent Shows at the bottom */}
              <RecentConcerts artistName={artist.name} mbid={artist.id} maxDisplay={5} />
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
        highlightedAlbum={highlightedAlbum}
        highlightedArtistIds={hoveredArtistId ? [hoveredArtistId] : undefined}
        onHeightChange={setTimelineHeight}
      />
    </div>
  );
}
