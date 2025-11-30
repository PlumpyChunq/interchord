'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useArtistRelationships } from '@/lib/musicbrainz/hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GraphView, LayoutType } from '@/components/graph';
import { addToFavorites, removeFromFavorites, isFavorite } from '@/components/artist-search';
import type { ArtistNode, ArtistRelationship, ArtistGraph } from '@/types';
import { getArtistRelationships } from '@/lib/musicbrainz/client';

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
    <div className="w-full max-w-7xl mx-auto space-y-4">
      <Button variant="outline" onClick={onBack} className="mb-4">
        ← Back to Search
      </Button>

      {/* Artist Header - Compact */}
      <div className="flex items-center justify-between bg-white p-3 rounded-lg border">
        <div className="flex items-center gap-2">
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
      <div className="flex items-center justify-between flex-wrap gap-2 bg-white p-2 rounded-lg border">
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
            <Button variant="outline" size="sm" onClick={handleResetGraph} disabled={isExpanding}>
              Reset Graph
            </Button>
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
        <div className="flex gap-4" style={{ height: 'calc(100vh - 250px)', minHeight: '400px' }}>
          {/* Main Graph View */}
          <div className={`relative flex-1 h-full ${showList ? 'min-w-0' : ''}`}>
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
              selectedNodeId={selectedNodeId}
              layoutType={layoutType}
              networkDepth={expansionDepth}
              onLayoutChange={setLayoutType}
            />
            <div className="mt-2 text-center text-sm text-gray-500">
              {graphData.nodes.length} artists • {graphData.edges.length} connections
            </div>
          </div>

          {/* List Sidebar */}
          {showList && (
            <div className="w-72 flex-shrink-0 h-full overflow-y-auto space-y-2">
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
                              : 'hover:bg-gray-50'
                          }`}
                          onClick={() => handleSidebarNodeSelect(relatedArtist)}
                          onDoubleClick={() => handleSidebarNodeNavigate(relatedArtist)}
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}
