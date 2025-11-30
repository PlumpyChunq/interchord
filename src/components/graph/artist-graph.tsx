'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import cytoscape, { Core, NodeSingular, Layouts } from 'cytoscape';
import cola from 'cytoscape-cola';
import type { ArtistGraph as ArtistGraphType, ArtistNode } from '@/types';

// Register the cola layout extension
if (typeof cytoscape('core', 'cola') === 'undefined') {
  cytoscape.use(cola);
}

interface ArtistGraphProps {
  graph: ArtistGraphType;
  onNodeClick?: (artist: ArtistNode) => void;
  onNodeExpand?: (artistId: string) => void;
  selectedNodeId?: string | null;
  className?: string;
  cyRef?: React.MutableRefObject<Core | null>;
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
}: ArtistGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const internalCyRef = useRef<Core | null>(null);
  const cyRef = externalCyRef || internalCyRef;
  const layoutRef = useRef<Layouts | null>(null);
  const isDestroyedRef = useRef(false);
  const [isLayouting, setIsLayouting] = useState(false);

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

  // Get cola layout options with interactive physics
  const getLayoutOptions = useCallback((nodeCount: number, cy?: Core): cytoscape.LayoutOptions => {
    const isLarge = nodeCount > 100;
    const isMedium = nodeCount > 30;

    // Get container dimensions for centering
    const width = containerRef.current?.clientWidth || 800;
    const height = containerRef.current?.clientHeight || 600;
    const centerX = width / 2;
    const centerY = height / 2;

    // Find root node for constraints
    const rootNode = cy?.$('node[root = "true"]').first();
    const rootId = rootNode?.id();

    // Build constraints to fix root at center
    const constraints: unknown[] = [];
    if (rootId) {
      constraints.push({
        type: 'position',
        node: rootId,
        position: { x: centerX, y: centerY },
        weight: 1, // Strong constraint
      });
    }

    return {
      name: 'cola',
      animate: true,
      refresh: 1,
      maxSimulationTime: isLarge ? 2000 : 4000,
      ungrabifyWhileSimulating: false,
      fit: true, // Fit all nodes in view
      padding: 20,

      // Node spacing
      nodeSpacing: () => isLarge ? 30 : isMedium ? 50 : 80,

      // Edge length
      edgeLength: isLarge ? 100 : isMedium ? 150 : 200,

      // Flow direction - center root node
      flow: undefined,

      // Alignment constraint - none needed
      alignment: undefined,

      // Gap between nodes in same rank
      gapInequalities: undefined,

      // Center the graph
      centerGraph: true,

      // Handle disconnected components
      handleDisconnected: true,

      // Convergence threshold
      convergenceThreshold: 0.01,

      // Avoid overlap
      avoidOverlap: true,

      // Infinite simulation for interactive dragging
      infinite: false,

      // Randomize initial positions
      randomize: false,

      // Fix root node at center
      constraints: constraints.length > 0 ? constraints : undefined,
    } as cytoscape.LayoutOptions;
  }, []);

  // Run layout function
  const runLayout = useCallback((centerOnRoot = true) => {
    if (!cyRef.current || isDestroyedRef.current) return;

    const cy = cyRef.current;
    setIsLayouting(true);

    // Stop any running layout
    if (layoutRef.current) {
      layoutRef.current.stop();
    }

    // Get the root node and center it first
    const rootNode = cy.$('node[root = "true"]');
    const containerWidth = containerRef.current?.clientWidth || 800;
    const containerHeight = containerRef.current?.clientHeight || 600;

    if (centerOnRoot && rootNode.length) {
      // Position root at center before layout and lock it
      rootNode.unlock(); // Temporarily unlock to reposition
      rootNode.position({
        x: containerWidth / 2,
        y: containerHeight / 2
      });
      rootNode.lock(); // Re-lock to keep at center
    }

    const options = getLayoutOptions(cy.nodes().length, cy);
    layoutRef.current = cy.layout({
      ...options,
      stop: () => {
        if (isDestroyedRef.current || cy.destroyed()) return;
        setIsLayouting(false);
        // After layout, fit all nodes in view
        try {
          cy.fit(undefined, 20);
        } catch {
          // Ignore errors during cleanup
        }
      },
    });
    layoutRef.current.run();
  }, [getLayoutOptions]);

  // Fit to view
  const fitToView = useCallback(() => {
    if (!cyRef.current || isDestroyedRef.current) return;
    cyRef.current.fit(undefined, 50);
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

    // Position root node at center before initial layout and lock it
    const rootNode = cy.$('node[root = "true"]');
    if (rootNode.length && containerRef.current) {
      const containerWidth = containerRef.current.clientWidth || 800;
      const containerHeight = containerRef.current.clientHeight || 600;
      rootNode.position({
        x: containerWidth / 2,
        y: containerHeight / 2
      });
      // Lock the root node so it stays at center
      rootNode.lock();
    }

    // Run initial layout
    setIsLayouting(true);
    const options = getLayoutOptions(cy.nodes().length, cy);
    layoutRef.current = cy.layout({
      ...options,
      stop: () => {
        if (isDestroyedRef.current || cy.destroyed()) return;
        setIsLayouting(false);
        // Fit all nodes in view after layout
        try {
          cy.fit(undefined, 20);
        } catch {
          // Ignore errors during cleanup
        }
      },
    });
    layoutRef.current.run();

    // Handle node drag - re-run layout to maintain physics
    let dragTimeout: NodeJS.Timeout | null = null;

    cy.on('drag', 'node', () => {
      // Debounce layout re-run during drag
      if (dragTimeout) clearTimeout(dragTimeout);
      dragTimeout = setTimeout(() => {
        if (!isDestroyedRef.current && cyRef.current && !cy.destroyed()) {
          // Re-run layout but don't reset positions
          try {
            const newLayout = cy.layout({
              name: 'cola',
              animate: true,
              fit: false,
              randomize: false,
              maxSimulationTime: 1000,
              handleDisconnected: true,
              avoidOverlap: true,
            } as unknown as cytoscape.LayoutOptions);
            layoutRef.current = newLayout;
            newLayout.run();
          } catch {
            // Ignore errors during cleanup
          }
        }
      }, 100);
    });

    cy.on('free', 'node', () => {
      // When node is released, run a quick re-layout
      if (!isDestroyedRef.current && cyRef.current && !cy.destroyed()) {
        try {
          const newLayout = cy.layout({
            name: 'cola',
            animate: true,
            fit: false,
            randomize: false,
            maxSimulationTime: 1500,
            handleDisconnected: true,
            avoidOverlap: true,
          } as unknown as cytoscape.LayoutOptions);
          layoutRef.current = newLayout;
          newLayout.run();
        } catch {
          // Ignore errors during cleanup
        }
      }
    });

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
      if (dragTimeout) clearTimeout(dragTimeout);
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

    cyRef.current.nodes().unselect();
    if (selectedNodeId) {
      cyRef.current.$(`#${selectedNodeId}`).select();
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
    runLayout(true);
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
          onClick={() => runLayout(true)}
          disabled={isLayouting}
          className="w-8 h-8 bg-white/90 backdrop-blur rounded shadow-sm hover:bg-gray-100 flex items-center justify-center text-gray-600 disabled:opacity-50"
          title="Re-layout graph (center on main artist)"
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
        <p><strong>Drag nodes</strong> - connected nodes will follow</p>
        <p>Scroll to zoom • Drag background to pan</p>
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
