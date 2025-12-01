'use client';

import { useRef } from 'react';
import { Core } from 'cytoscape';
import { ArtistGraph, LayoutType } from './artist-graph';
import type { ArtistGraph as ArtistGraphType, ArtistNode } from '@/types';
import type { GraphFilterState } from './graph-filters';

interface GraphViewProps {
  graph: ArtistGraphType;
  isLoading?: boolean;
  /** Called when a node is clicked. Receives null when clicking the background to clear selection. */
  onNodeClick?: (artist: ArtistNode | null) => void;
  onNodeExpand?: (artistId: string) => void;
  /** Called when hovering over a node in the graph. Receives null when mouse leaves. */
  onNodeHover?: (artistId: string | null) => void;
  selectedNodeId?: string | null;
  hoveredNodeId?: string | null;
  layoutType?: LayoutType;
  networkDepth?: number;
  onLayoutChange?: (layout: LayoutType) => void;
  filters?: GraphFilterState;
}

export function GraphView({
  graph,
  isLoading,
  onNodeClick,
  onNodeExpand,
  onNodeHover,
  selectedNodeId,
  hoveredNodeId,
  layoutType = 'auto',
  networkDepth = 1,
  onLayoutChange,
  filters,
}: GraphViewProps) {
  const cyRef = useRef<Core | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[400px] bg-gray-50 rounded-lg border">
        <div className="text-center text-gray-500">
          <div className="animate-pulse mb-2">Loading graph...</div>
          <p className="text-sm">Building artist relationships</p>
        </div>
      </div>
    );
  }

  if (graph.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] bg-gray-50 rounded-lg border">
        <div className="text-center text-gray-500">
          <p>No graph data available</p>
          <p className="text-sm mt-1">Select an artist to build their relationship graph</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[500px]">
      <ArtistGraph
        graph={graph}
        onNodeClick={onNodeClick}
        onNodeExpand={onNodeExpand}
        onNodeHover={onNodeHover}
        selectedNodeId={selectedNodeId}
        hoveredNodeId={hoveredNodeId}
        className="h-full"
        cyRef={cyRef}
        layoutType={layoutType}
        networkDepth={networkDepth}
        onLayoutChange={onLayoutChange}
        filters={filters}
      />
    </div>
  );
}

export { ArtistGraph } from './artist-graph';
export type { LayoutType } from './artist-graph';
export { GraphFilters, getDefaultFilters } from './graph-filters';
export type { GraphFilterState } from './graph-filters';
