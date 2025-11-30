'use client';

import { useRef, useCallback, useState } from 'react';
import { Core } from 'cytoscape';
import { ArtistGraph } from './artist-graph';
import { GraphControls } from './graph-controls';
import { Button } from '@/components/ui/button';
import type { ArtistGraph as ArtistGraphType, ArtistNode } from '@/types';

interface GraphViewProps {
  graph: ArtistGraphType;
  isLoading?: boolean;
  onNodeClick?: (artist: ArtistNode) => void;
  onNodeExpand?: (artistId: string) => void;
  selectedNodeId?: string | null;
}

export function GraphView({
  graph,
  isLoading,
  onNodeClick,
  onNodeExpand,
  selectedNodeId,
}: GraphViewProps) {
  const cyRef = useRef<Core | null>(null);
  const [showGraph, setShowGraph] = useState(true);

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

  if (!showGraph) {
    return (
      <div className="flex items-center justify-center h-[400px] bg-gray-50 rounded-lg border">
        <Button onClick={() => setShowGraph(true)}>Show Graph View</Button>
      </div>
    );
  }

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
    <div className="relative h-[600px]">
      <ArtistGraph
        graph={graph}
        onNodeClick={onNodeClick}
        onNodeExpand={onNodeExpand}
        selectedNodeId={selectedNodeId}
        className="h-full"
        cyRef={cyRef}
      />
      <GraphControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFit={handleFit}
        onReset={handleReset}
      />
      <Button
        variant="outline"
        size="sm"
        className="absolute bottom-4 right-4"
        onClick={() => setShowGraph(false)}
      >
        Hide Graph
      </Button>
    </div>
  );
}

export { ArtistGraph } from './artist-graph';
export { GraphControls } from './graph-controls';
