'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { ArtistGraph, ArtistNode, ArtistRelationship } from '@/types';
import type { ExpansionDepth } from './types';
import { buildGraphData, mergeGraphData } from './builder';
import { cacheGet, cacheSet, CacheTTL } from '@/lib/cache';

interface RelationshipsData {
  artist: ArtistNode;
  relationships: ArtistRelationship[];
  relatedArtists: ArtistNode[];
}

interface SupplementDataResponse {
  foundingMemberMbids: string[];
}

/**
 * Fetch supplementary data (founding members from Wikipedia) for a band
 * Only fetches for groups, returns null for solo artists
 */
async function getSupplementDataCached(
  mbid: string,
  name: string,
  type: string
): Promise<Set<string> | null> {
  // Only fetch for groups/bands
  if (type !== 'group') return null;

  const cacheKey = `supplement-founders-${mbid}`;

  // Check localStorage cache first
  const cached = cacheGet<string[]>(cacheKey);
  if (cached) {
    console.log(`[Cache HIT] Supplement founders for ${name}`);
    return new Set(cached);
  }

  console.log(`[Cache MISS] Fetching supplement founders for ${name}`);

  try {
    const response = await fetch(
      `/api/supplement?mbid=${encodeURIComponent(mbid)}&name=${encodeURIComponent(name)}`
    );

    if (!response.ok) {
      // Not found is okay - not all bands have Wikipedia data
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch supplement: ${response.status}`);
    }

    const data: SupplementDataResponse = await response.json();
    const founders = data.foundingMemberMbids || [];

    // Cache for 1 week
    cacheSet(cacheKey, founders, CacheTTL.LONG);

    console.log(`[Cache SET] Supplement founders for ${name}: ${founders.length} members`);

    return founders.length > 0 ? new Set(founders) : null;
  } catch (error) {
    console.warn('Failed to fetch supplement data:', error);
    return null;
  }
}

/**
 * Fetch artist relationships with localStorage caching
 * Uses API route which leverages local DB when available
 */
async function getArtistRelationshipsCached(mbid: string): Promise<RelationshipsData | null> {
  const cacheKey = `artist-relationships-${mbid}`;

  // Check localStorage cache first
  const cached = cacheGet<RelationshipsData>(cacheKey);
  if (cached) {
    console.log(`[Cache HIT] Relationships for ${mbid}`);
    return cached;
  }

  console.log(`[Cache MISS] Fetching relationships for ${mbid}`);

  try {
    // Use API route which tries local DB first, falls back to rate-limited API
    const response = await fetch(`/api/musicbrainz/artist/${mbid}?include=relationships`);

    if (!response.ok) {
      throw new Error(`Failed to fetch relationships: ${response.status}`);
    }

    const data = await response.json();

    const result: RelationshipsData = {
      artist: data.artist,
      relationships: data.relationships,
      relatedArtists: data.relatedArtists,
    };

    // Cache for 1 week (relationships rarely change)
    cacheSet(cacheKey, result, CacheTTL.LONG);

    console.log(`[Cache SET] Relationships for ${mbid} (source: ${data.source}, ${data.latencyMs}ms)`);

    return result;
  } catch (error) {
    console.error('Failed to fetch relationships:', error);
    return null;
  }
}

export interface UseGraphExpansionResult {
  graphData: ArtistGraph;
  isExpanding: boolean;
  expandProgress: { current: number; total: number } | null;
  expansionDepth: ExpansionDepth;
  availableRelTypes: string[];
  supplementaryFounders: Set<string> | undefined;
  handleDepthChange: (depth: ExpansionDepth) => void;
  handleNodeExpand: (nodeId: string) => Promise<void>;
  handleResetGraph: () => void;
  hasExpandedGraph: boolean;
}

export function useGraphExpansion(
  artistId: string,
  initialData: RelationshipsData | undefined
): UseGraphExpansionResult {
  const [expandedGraph, setExpandedGraph] = useState<ArtistGraph | null>(null);
  const [isExpanding, setIsExpanding] = useState(false);
  const [autoExpandComplete, setAutoExpandComplete] = useState(false);
  const [expansionDepth, setExpansionDepth] = useState<ExpansionDepth>(1);
  const [expandProgress, setExpandProgress] = useState<{ current: number; total: number } | null>(null);

  // Supplementary founders from Wikipedia
  const [supplementaryFounders, setSupplementaryFounders] = useState<Set<string> | null>(null);
  const supplementFetchedRef = useRef<string | null>(null);

  // Fetch supplement data when initial data loads (for bands only)
  useEffect(() => {
    if (!initialData || supplementFetchedRef.current === artistId) return;
    if (initialData.artist.type !== 'group') return;

    supplementFetchedRef.current = artistId;

    // Fetch in background (non-blocking)
    getSupplementDataCached(
      initialData.artist.id,
      initialData.artist.name,
      initialData.artist.type
    ).then((founders) => {
      if (founders && founders.size > 0) {
        console.log(`[Supplement] Found ${founders.size} Wikipedia founders for ${initialData.artist.name}`);
        setSupplementaryFounders(founders);
      }
    });
  }, [initialData, artistId]);

  // Build initial graph data from relationships
  const initialGraphData = useMemo<ArtistGraph>(() => {
    if (!initialData) return { nodes: [], edges: [] };
    return buildGraphData(
      initialData.artist,
      initialData.relationships,
      initialData.relatedArtists,
      initialData.artist.activeYears?.begin,
      supplementaryFounders ?? undefined
    );
  }, [initialData, supplementaryFounders]);

  // Use expanded graph if available, otherwise initial
  // Then apply supplementary founding member data as post-processing
  const graphData = useMemo(() => {
    const baseGraph = expandedGraph || initialGraphData;

    // If no supplement data, return as-is
    if (!supplementaryFounders || supplementaryFounders.size === 0) {
      return baseGraph;
    }

    // Apply founding member status to nodes that match supplement MBIDs
    // This handles the case where supplement data arrives AFTER the graph was built
    return {
      ...baseGraph,
      nodes: baseGraph.nodes.map(node => {
        const isSupplementaryFounder = supplementaryFounders.has(node.data.id);
        // Only update if this node should be a founder but isn't marked yet
        if (isSupplementaryFounder && !node.data.founding) {
          return {
            ...node,
            data: {
              ...node.data,
              founding: true,
            },
          };
        }
        return node;
      }),
    };
  }, [expandedGraph, initialGraphData, supplementaryFounders]);

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
    if (!initialData || isExpanding) return;

    setIsExpanding(true);
    setAutoExpandComplete(true);

    let currentGraph = buildGraphData(
      initialData.artist,
      initialData.relationships,
      initialData.relatedArtists,
      initialData.artist.activeYears?.begin,
      supplementaryFounders ?? undefined
    );

    if (depth === 1) {
      setExpandedGraph(currentGraph);
      setIsExpanding(false);
      return;
    }

    const nodeDepths = new Map<string, number>();
    nodeDepths.set(initialData.artist.id, 0);
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
        setExpandProgress({ current: i + 1, total: nodesToExpand.length });

        try {
          const expandedData = await getArtistRelationshipsCached(nodeToExpand.id);

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
    setExpandProgress(null);
  }, [initialData, isExpanding, supplementaryFounders]);

  // Auto-expand when data loads
  useEffect(() => {
    if (!initialData || autoExpandComplete || isExpanding) return;
    performMultiLevelExpansion(expansionDepth);
  }, [initialData, autoExpandComplete, isExpanding, expansionDepth, performMultiLevelExpansion]);

  // Handle expansion depth change
  const handleDepthChange = useCallback((newDepth: ExpansionDepth) => {
    if (newDepth === expansionDepth || isExpanding) return;
    setExpansionDepth(newDepth);
    setAutoExpandComplete(false);
    setExpandedGraph(null);
  }, [expansionDepth, isExpanding]);

  // Handle node expansion
  const handleNodeExpand = useCallback(async (nodeId: string) => {
    if (isExpanding) return;

    setIsExpanding(true);

    try {
      const expandedData = await getArtistRelationshipsCached(nodeId);

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
    }
  }, [isExpanding, expandedGraph, initialGraphData]);

  // Reset graph
  const handleResetGraph = useCallback(() => {
    setExpandedGraph(null);
    setAutoExpandComplete(false);
  }, []);

  return {
    graphData,
    isExpanding,
    expandProgress,
    expansionDepth,
    availableRelTypes,
    supplementaryFounders: supplementaryFounders ?? undefined,
    handleDepthChange,
    handleNodeExpand,
    handleResetGraph,
    hasExpandedGraph: expandedGraph !== null,
  };
}
