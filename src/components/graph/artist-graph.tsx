'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import cytoscape, { Core, NodeSingular, Layouts } from 'cytoscape';
import cola from 'cytoscape-cola';
import dagre from 'cytoscape-dagre';
import type { ArtistGraph as ArtistGraphType, ArtistNode } from '@/types';

// Register layout extensions
if (typeof cytoscape('core', 'cola') === 'undefined') {
  cytoscape.use(cola);
}
if (typeof cytoscape('core', 'dagre') === 'undefined') {
  cytoscape.use(dagre);
}

// Layout types available to users
export type LayoutType = 'auto' | 'radial' | 'force' | 'hierarchical' | 'concentric';

interface ArtistGraphProps {
  graph: ArtistGraphType;
  onNodeClick?: (artist: ArtistNode) => void;
  onNodeExpand?: (artistId: string) => void;
  selectedNodeId?: string | null;
  className?: string;
  cyRef?: React.MutableRefObject<Core | null>;
  layoutType?: LayoutType;
  networkDepth?: number;
  onLayoutChange?: (layout: LayoutType) => void;
}

// Cytoscape stylesheet
const cytoscapeStyle: cytoscape.StylesheetStyle[] = [
  // Node base styles
  {
    selector: 'node',
    style: {
      'label': 'data(label)',
      'text-valign': 'bottom',
      'text-halign': 'center',
      'text-margin-y': 8,
      'font-size': 10,
      'font-weight': 500,
      'color': '#374151',
      'text-outline-color': '#ffffff',
      'text-outline-width': 2,
      'background-color': '#6b7280',
      'border-width': 2,
      'border-color': '#ffffff',
      'width': 35,
      'height': 35,
      'transition-property': 'background-color, border-color, width, height',
      'transition-duration': 200,
      'overlay-opacity': 0,
      'text-wrap': 'wrap',
      'text-max-width': 100,
    },
  },
  // Group nodes (bands) - larger
  {
    selector: 'node[type = "group"]',
    style: {
      'background-color': '#3b82f6',
      'width': 50,
      'height': 50,
      'font-size': 12,
      'font-weight': 600,
    },
  },
  // Person nodes
  {
    selector: 'node[type = "person"]',
    style: {
      'background-color': '#10b981',
      'width': 35,
      'height': 35,
    },
  },
  // Founding members - gold border
  {
    selector: 'node[founding = "true"]',
    style: {
      'border-color': '#f59e0b',
      'border-width': 4,
    },
  },
  // Selected node
  {
    selector: 'node:selected',
    style: {
      'border-color': '#ef4444',
      'border-width': 4,
      'background-color': '#fef2f2',
    },
  },
  // Highlighted neighbor nodes (connected to selected)
  {
    selector: 'node.highlighted',
    style: {
      'border-color': '#f97316',
      'border-width': 3,
      'background-opacity': 1,
    },
  },
  // Highlighted edges (connected to selected node)
  {
    selector: 'edge.highlighted',
    style: {
      'width': 3,
      'opacity': 1,
      'line-color': '#f97316',
      'target-arrow-color': '#f97316',
    },
  },
  // Dimmed nodes (not selected or connected)
  {
    selector: 'node.dimmed',
    style: {
      'opacity': 0.3,
    },
  },
  // Dimmed edges (not connected to selected)
  {
    selector: 'edge.dimmed',
    style: {
      'opacity': 0.15,
    },
  },
  // Grabbed/dragging node
  {
    selector: 'node:grabbed',
    style: {
      'border-color': '#6366f1',
      'border-width': 4,
      'overlay-opacity': 0.1,
    },
  },
  // Root/center node - MUCH larger and prominent
  {
    selector: 'node[root = "true"]',
    style: {
      'width': 80,
      'height': 80,
      'font-size': 14,
      'font-weight': 700,
      'border-width': 5,
      'border-color': '#1f2937',
      'background-color': '#2563eb',
    },
  },
  // Not yet expanded nodes
  {
    selector: 'node[loaded = "false"]',
    style: {
      'background-opacity': 0.7,
      'border-style': 'dashed',
    },
  },
  // Edge base styles
  {
    selector: 'edge',
    style: {
      'width': 1.5,
      'line-color': '#d1d5db',
      'target-arrow-color': '#d1d5db',
      'target-arrow-shape': 'triangle',
      'arrow-scale': 0.8,
      'curve-style': 'bezier',
      'opacity': 0.6,
    },
  },
  // Edge colors by type
  {
    selector: 'edge[type = "member_of"]',
    style: {
      'line-color': '#93c5fd',
      'target-arrow-color': '#93c5fd',
    },
  },
  {
    selector: 'edge[type = "founder_of"]',
    style: {
      'line-color': '#fcd34d',
      'target-arrow-color': '#fcd34d',
      'width': 2,
    },
  },
  {
    selector: 'edge[type = "collaboration"]',
    style: {
      'line-color': '#6ee7b7',
      'target-arrow-color': '#6ee7b7',
      'line-style': 'dashed',
    },
  },
  {
    selector: 'edge[type = "producer"]',
    style: {
      'line-color': '#c4b5fd',
      'target-arrow-color': '#c4b5fd',
    },
  },
  {
    selector: 'edge[type = "side_project"]',
    style: {
      'line-color': '#f9a8d4',
      'target-arrow-color': '#f9a8d4',
      'line-style': 'dashed',
    },
  },
];

export function ArtistGraph({
  graph,
  onNodeClick,
  onNodeExpand,
  selectedNodeId,
  className = '',
  cyRef: externalCyRef,
  layoutType = 'auto',
  networkDepth = 1,
  onLayoutChange,
}: ArtistGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const internalCyRef = useRef<Core | null>(null);
  const cyRef = externalCyRef || internalCyRef;
  const layoutRef = useRef<Layouts | null>(null);
  const isDestroyedRef = useRef(false);
  const [isLayouting, setIsLayouting] = useState(false);
  const [currentLayout, setCurrentLayout] = useState<LayoutType>(layoutType);

  // Layout display names for the dropdown
  const layoutOptions: { value: LayoutType; label: string }[] = [
    { value: 'auto', label: 'Auto (Depth-based)' },
    { value: 'radial', label: 'Radial Spoke' },
    { value: 'force', label: 'Force-Directed' },
    { value: 'hierarchical', label: 'Hierarchical' },
    { value: 'concentric', label: 'Concentric Rings' },
  ];

  // Convert our graph format to Cytoscape elements
  const convertToElements = useCallback(() => {
    const nodes = graph.nodes.map((node, index) => {
      // Build label with instruments if available
      const instruments = node.data.instruments?.slice(0, 3).join(', ') || '';
      const label = instruments ? `${node.data.name}\n${instruments}` : node.data.name;

      return {
        data: {
          id: node.data.id,
          name: node.data.name,
          label: label,
          instruments: instruments,
          type: node.data.type,
          loaded: node.data.loaded ? 'true' : 'false',
          founding: node.data.founding ? 'true' : 'false',
          root: index === 0 ? 'true' : 'false',
        },
      };
    });

    const edges = graph.edges.map((edge) => ({
      data: {
        id: edge.data.id,
        source: edge.data.source,
        target: edge.data.target,
        type: edge.data.type,
      },
    }));

    return [...nodes, ...edges];
  }, [graph]);

  // Calculate BFS depth from root node for each node
  const calculateNodeDepths = useCallback((cy: Core): Map<string, number> => {
    const depths = new Map<string, number>();
    const rootNode = cy.$('node[root = "true"]').first();

    if (!rootNode.length) return depths;

    const rootId = rootNode.id();
    depths.set(rootId, 0);

    // BFS to calculate depths
    const queue: string[] = [rootId];
    const visited = new Set<string>([rootId]);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentDepth = depths.get(currentId)!;
      const currentNode = cy.$(`#${currentId}`);

      // Get all connected nodes (neighbors)
      const neighbors = currentNode.neighborhood('node');
      neighbors.forEach((neighbor) => {
        const neighborId = neighbor.id();
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          depths.set(neighborId, currentDepth + 1);
          queue.push(neighborId);
        }
      });
    }

    return depths;
  }, []);

  // Determine effective layout based on 'auto' mode and network depth
  const getEffectiveLayout = useCallback((layout: LayoutType, depth: number): Exclude<LayoutType, 'auto'> => {
    if (layout !== 'auto') return layout;
    // Auto mode: Force at depth 1, Radial at depth 2+
    return depth === 1 ? 'force' : 'radial';
  }, []);

  // Get layout options for the specified layout type
  const getLayoutOptions = useCallback((nodeCount: number, cy?: Core, layout?: LayoutType): cytoscape.LayoutOptions => {
    const isLarge = nodeCount > 100;
    const isMedium = nodeCount > 30;
    const effectiveLayout = getEffectiveLayout(layout || currentLayout, networkDepth);
    const rootNode = cy?.$('node[root = "true"]').first();
    const rootId = rootNode?.id();

    switch (effectiveLayout) {
      case 'force':
        // Cola force-directed layout - organic, interactive
        return {
          name: 'cola',
          animate: true,
          refresh: 1,
          maxSimulationTime: isLarge ? 2000 : 4000,
          ungrabifyWhileSimulating: false,
          fit: true,
          padding: 30,
          nodeSpacing: () => isLarge ? 30 : isMedium ? 50 : 80,
          edgeLength: isLarge ? 100 : isMedium ? 150 : 200,
          centerGraph: true,
          handleDisconnected: true,
          convergenceThreshold: 0.01,
          avoidOverlap: true,
          infinite: false,
          randomize: false,
        } as unknown as cytoscape.LayoutOptions;

      case 'hierarchical':
        // Dagre hierarchical layout - tree structure
        return {
          name: 'dagre',
          fit: true,
          padding: 30,
          rankDir: 'TB', // Top to bottom
          ranker: 'network-simplex',
          nodeSep: isLarge ? 30 : isMedium ? 50 : 70,
          rankSep: isLarge ? 50 : isMedium ? 80 : 100,
          edgeSep: 10,
          animate: true,
          animationDuration: 500,
          animationEasing: 'ease-out',
        } as unknown as cytoscape.LayoutOptions;

      case 'concentric':
        // Concentric layout - rings based on degree
        const depths = cy ? calculateNodeDepths(cy) : new Map<string, number>();
        const maxDepth = Math.max(0, ...Array.from(depths.values()));
        return {
          name: 'concentric',
          fit: true,
          padding: 30,
          startAngle: Math.PI * 3 / 2,
          sweep: Math.PI * 2,
          clockwise: true,
          equidistant: false,
          minNodeSpacing: isLarge ? 20 : isMedium ? 40 : 60,
          avoidOverlap: true,
          nodeDimensionsIncludeLabels: true,
          animate: true,
          animationDuration: 500,
          concentric: (node: NodeSingular) => {
            const nodeId = node.id();
            const depth = depths.get(nodeId) ?? maxDepth;
            return maxDepth - depth + 1;
          },
          levelWidth: () => 1,
          spacingFactor: isLarge ? 1.2 : isMedium ? 1.5 : 1.75,
        } as unknown as cytoscape.LayoutOptions;

      case 'radial':
      default:
        // Breadthfirst circle layout - spoke pattern
        return {
          name: 'breadthfirst',
          fit: true,
          directed: false,
          padding: 30,
          circle: true,
          grid: false,
          spacingFactor: isLarge ? 1.0 : isMedium ? 1.25 : 1.5,
          avoidOverlap: true,
          nodeDimensionsIncludeLabels: false,
          roots: rootId ? `#${rootId}` : undefined,
          animate: true,
          animationDuration: 500,
          animationEasing: 'ease-out',
          maximal: false,
        } as unknown as cytoscape.LayoutOptions;
    }
  }, [calculateNodeDepths, currentLayout, networkDepth, getEffectiveLayout]);

  // Handle layout change from dropdown
  const handleLayoutChange = useCallback((newLayout: LayoutType) => {
    setCurrentLayout(newLayout);
    onLayoutChange?.(newLayout);

    // Re-run layout with the new type
    if (cyRef.current && !isDestroyedRef.current) {
      const cy = cyRef.current;
      setIsLayouting(true);

      if (layoutRef.current) {
        layoutRef.current.stop();
      }

      const options = getLayoutOptions(cy.nodes().length, cy, newLayout);
      layoutRef.current = cy.layout({
        ...options,
        stop: () => {
          if (isDestroyedRef.current || cy.destroyed()) return;
          setIsLayouting(false);
        },
      });
      layoutRef.current.run();
    }
  }, [onLayoutChange, getLayoutOptions]);

  // Run layout function
  const runLayout = useCallback(() => {
    if (!cyRef.current || isDestroyedRef.current) return;

    const cy = cyRef.current;
    setIsLayouting(true);

    // Stop any running layout
    if (layoutRef.current) {
      layoutRef.current.stop();
    }

    const options = getLayoutOptions(cy.nodes().length, cy);
    layoutRef.current = cy.layout({
      ...options,
      stop: () => {
        if (isDestroyedRef.current || cy.destroyed()) return;
        setIsLayouting(false);
      },
    });
    layoutRef.current.run();
  }, [getLayoutOptions]);

  // Fit to view
  const fitToView = useCallback(() => {
    if (!cyRef.current || isDestroyedRef.current) return;
    cyRef.current.fit(undefined, 20);
    const root = cyRef.current.$('node[root = "true"]');
    if (root.length) {
      cyRef.current.center(root);
    }
  }, []);

  // Center on root node
  const centerOnRoot = useCallback(() => {
    if (!cyRef.current || isDestroyedRef.current) return;
    const root = cyRef.current.$('node[root = "true"]');
    if (root.length) {
      cyRef.current.center(root);
    }
  }, []);

  // Initialize Cytoscape
  useEffect(() => {
    if (!containerRef.current) return;

    isDestroyedRef.current = false;

    const cy = cytoscape({
      container: containerRef.current,
      elements: convertToElements(),
      style: cytoscapeStyle,
      layout: { name: 'preset' },
      minZoom: 0.1,
      maxZoom: 4,
      autoungrabify: false,
      autounselectify: false,
    });

    cyRef.current = cy;

    // Run initial layout with concentric pattern
    setIsLayouting(true);
    const options = getLayoutOptions(cy.nodes().length, cy);
    layoutRef.current = cy.layout({
      ...options,
      stop: () => {
        if (isDestroyedRef.current || cy.destroyed()) return;
        setIsLayouting(false);
      },
    });
    layoutRef.current.run();

    // Handle resize - update graph when container size changes
    const resizeObserver = new ResizeObserver(() => {
      if (isDestroyedRef.current || !cyRef.current || cy.destroyed()) return;
      try {
        cy.resize();
        cy.fit(undefined, 30);
      } catch {
        // Ignore errors during cleanup
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Node click handler
    cy.on('tap', 'node', (event) => {
      if (isDestroyedRef.current) return;
      const node = event.target as NodeSingular;
      const nodeData = node.data();

      if (onNodeClick) {
        const artistNode: ArtistNode = {
          id: nodeData.id,
          name: nodeData.name,
          type: nodeData.type,
          loaded: nodeData.loaded === 'true',
        };
        onNodeClick(artistNode);
      }
    });

    // Double-click to expand
    cy.on('dbltap', 'node', (event) => {
      if (isDestroyedRef.current) return;
      const node = event.target as NodeSingular;
      const nodeData = node.data();

      if (nodeData.loaded === 'false' && onNodeExpand) {
        onNodeExpand(nodeData.id);
      }
    });

    // Cleanup
    return () => {
      isDestroyedRef.current = true;
      resizeObserver.disconnect();
      if (layoutRef.current) {
        try {
          layoutRef.current.stop();
        } catch {
          // Ignore errors
        }
        layoutRef.current = null;
      }
      // Remove all event handlers before destroying
      try {
        cy.removeAllListeners();
        cy.destroy();
      } catch {
        // Ignore errors during cleanup
      }
      cyRef.current = null;
    };
  }, [convertToElements, onNodeClick, onNodeExpand, getLayoutOptions]);

  // Update selection when selectedNodeId changes
  useEffect(() => {
    if (!cyRef.current || isDestroyedRef.current) return;

    const cy = cyRef.current;

    // Clear all previous highlights
    cy.nodes().unselect().removeClass('highlighted dimmed');
    cy.edges().removeClass('highlighted dimmed');

    if (selectedNodeId) {
      const selectedNode = cy.$(`#${selectedNodeId}`);
      if (selectedNode.length) {
        // Select the node
        selectedNode.select();

        // Get connected edges and neighboring nodes
        const connectedEdges = selectedNode.connectedEdges();
        const neighborNodes = selectedNode.neighborhood('node');

        // Highlight connected edges and neighbors
        connectedEdges.addClass('highlighted');
        neighborNodes.addClass('highlighted');

        // Dim all other nodes and edges
        cy.nodes().not(selectedNode).not(neighborNodes).addClass('dimmed');
        cy.edges().not(connectedEdges).addClass('dimmed');
      }
    }
  }, [selectedNodeId]);

  // Update elements when graph changes
  useEffect(() => {
    if (!cyRef.current || isDestroyedRef.current) return;

    const cy = cyRef.current;
    const elements = convertToElements();

    // Get existing node IDs
    const existingIds = new Set(cy.nodes().map((n) => n.id()));

    // Add new elements
    elements.forEach((el) => {
      if ('source' in el.data) {
        if (!cy.$(`#${el.data.id}`).length) {
          cy.add(el);
        }
      } else {
        if (!existingIds.has(el.data.id)) {
          cy.add(el);
        }
      }
    });

    // Run layout with new nodes
    runLayout();
  }, [graph, convertToElements, runLayout]);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={containerRef}
        className="w-full h-full min-h-[500px] bg-gray-50 rounded-lg border"
      />

      {/* Control buttons */}
      <div className="absolute top-4 left-4 flex flex-col gap-1">
        <button
          onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.2)}
          className="w-8 h-8 bg-white/90 backdrop-blur rounded shadow-sm hover:bg-gray-100 flex items-center justify-center text-gray-600"
          title="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => cyRef.current?.zoom(cyRef.current.zoom() / 1.2)}
          className="w-8 h-8 bg-white/90 backdrop-blur rounded shadow-sm hover:bg-gray-100 flex items-center justify-center text-gray-600"
          title="Zoom out"
        >
          −
        </button>
        <button
          onClick={fitToView}
          className="w-8 h-8 bg-white/90 backdrop-blur rounded shadow-sm hover:bg-gray-100 flex items-center justify-center text-gray-600"
          title="Fit to view"
        >
          ⛶
        </button>
        <button
          onClick={() => runLayout()}
          disabled={isLayouting}
          className="w-8 h-8 bg-white/90 backdrop-blur rounded shadow-sm hover:bg-gray-100 flex items-center justify-center text-gray-600 disabled:opacity-50"
          title="Re-layout graph (spoke pattern)"
        >
          ↻
        </button>
        <button
          onClick={centerOnRoot}
          className="w-8 h-8 bg-white/90 backdrop-blur rounded shadow-sm hover:bg-gray-100 flex items-center justify-center text-gray-600"
          title="Center on main artist"
        >
          ◎
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur p-3 rounded-lg shadow-sm text-xs space-y-1">
        <div className="font-semibold mb-2">Legend</div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-blue-500" />
          <span>Band/Group</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span>Person</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-amber-500" />
          <span>Founding Member</span>
        </div>
        <div className="flex items-center gap-2 mt-2 pt-2 border-t">
          <div className="w-4 h-0.5 bg-blue-500" />
          <span>Member of</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-emerald-500 border-dashed" style={{ borderTopWidth: 2, borderTopStyle: 'dashed' }} />
          <span>Collaboration</span>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-2 rounded-lg shadow-sm text-xs text-gray-600">
        <p>Click node to select • Double-click to expand</p>
        <p>Drag nodes • Scroll to zoom • Drag to pan</p>
      </div>

      {/* Layout indicator */}
      {isLayouting && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/90 backdrop-blur px-4 py-2 rounded-lg shadow-lg text-sm text-gray-600">
          <span className="animate-pulse">Organizing layout...</span>
        </div>
      )}
    </div>
  );
}
