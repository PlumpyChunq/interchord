'use client';

import { useRef, useCallback } from 'react';
import { Core } from 'cytoscape';
import { ArtistGraph, LayoutType } from './artist-graph';
import { GraphControls } from './graph-controls';
import type { ArtistGraph as ArtistGraphType, ArtistNode } from '@/types';

interface GraphViewProps {
  graph: ArtistGraphType;
  isLoading?: boolean;
  onNodeClick?: (artist: ArtistNode) => void;
  onNodeExpand?: (artistId: string) => void;
  selectedNodeId?: string | null;
  layoutType?: LayoutType;
  networkDepth?: number;
  onLayoutChange?: (layout: LayoutType) => void;
}

export function GraphView({
  graph,
  isLoading,
  onNodeClick,
  onNodeExpand,
  selectedNodeId,
  layoutType = 'auto',
  networkDepth = 1,
  onLayoutChange,
}: GraphViewProps) {
  const cyRef = useRef<Core | null>(null);

  const handleZoomIn = useCallback(() => {
    if (cyRef.current) {
      cyRef.current.zoom(cyRef.current.zoom() * 1.2);
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (cyRef.current) {
      cyRef.current.zoom(cyRef.current.zoom() / 1.2);
    }
  }, []);

  const handleFit = useCallback(() => {
    if (cyRef.current) {
      cyRef.current.fit(undefined, 50);
    }
  }, []);

  const handleReset = useCallback(() => {
    if (cyRef.current) {
      cyRef.current.reset();
      cyRef.current.fit(undefined, 50);
    }
  }, []);

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
        selectedNodeId={selectedNodeId}
        className="h-full"
        cyRef={cyRef}
        layoutType={layoutType}
        networkDepth={networkDepth}
        onLayoutChange={onLayoutChange}
      />
      <GraphControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFit={handleFit}
        onReset={handleReset}
      />
    </div>
  );
}

export { ArtistGraph, LayoutType } from './artist-graph';
export { GraphControls } from './graph-controls';
