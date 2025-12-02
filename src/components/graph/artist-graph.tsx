'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import cytoscape, { Core, NodeSingular, Layouts } from 'cytoscape';
import cola from 'cytoscape-cola';
import dagre from 'cytoscape-dagre';
import type { ArtistGraph as ArtistGraphType, ArtistNode, RelationshipType } from '@/types';
import type { GraphFilterState } from './graph-filters';
import { parseYear } from '@/lib/utils';

// Format tenure as years only (e.g., "1987–1994" or "2000–present")
function formatTenure(begin?: string, end?: string | null): string {
  const startYear = parseYear(begin);
  if (!startYear) return '';
  const endYear = parseYear(end);
  if (endYear) {
    return startYear === endYear ? String(startYear) : `${startYear}–${endYear}`;
  }
  return `${startYear}–`;
}

// Register layout extensions
if (typeof cytoscape('core', 'cola') === 'undefined') {
  cytoscape.use(cola);
}
if (typeof cytoscape('core', 'dagre') === 'undefined') {
  cytoscape.use(dagre);
}

// Constants for viewport threshold calculations
/** Threshold for determining if a node is in the "outer" region of viewport (triggers panning) */
const VIEWPORT_OUTER_THRESHOLD = 0.6;
/** How much to pan toward a selected node (percentage of distance) */
const PAN_DISTANCE_FACTOR = 0.3;

// Layout types available to users
export type LayoutType = 'auto' | 'radial' | 'force' | 'hierarchical' | 'concentric' | 'spoke';

interface ArtistGraphProps {
  graph: ArtistGraphType;
  /** Called when a node is clicked. Receives null when clicking the background to clear selection. */
  onNodeClick?: (artist: ArtistNode | null) => void;
  onNodeExpand?: (artistId: string) => void;
  /** Called when hovering over a node in the graph. Receives null when mouse leaves. */
  onNodeHover?: (artistId: string | null) => void;
  selectedNodeId?: string | null;
  hoveredNodeId?: string | null;
  className?: string;
  cyRef?: React.MutableRefObject<Core | null>;
  layoutType?: LayoutType;
  networkDepth?: number;
  onLayoutChange?: (layout: LayoutType) => void;
  filters?: GraphFilterState;
}

// Cytoscape stylesheet
const cytoscapeStyle = [
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
  // Dimmed nodes (not selected or connected)
  {
    selector: 'node.dimmed',
    style: {
      'opacity': 0.3,
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
  // Founding members - purple border (solid)
  // Must come AFTER loaded="false" to override the dashed border
  {
    selector: 'node[founding = "true"]',
    style: {
      'border-color': '#8b5cf6',
      'border-width': 4,
      'border-style': 'solid',
    },
  },
  // Hovered node (from sidebar hover) - yellow ring like timeline highlights
  // Must come AFTER loaded="false" to override the dashed border
  {
    selector: 'node.hovered',
    style: {
      'border-color': '#eab308',
      'border-width': 4,
      'border-style': 'solid',
      'z-index': 1000,
      'transition-property': 'border-color, border-width',
      'transition-duration': 300,
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
      'label': '',  // No label by default
      'font-size': 9,
      'text-background-color': '#ffffff',
      'text-background-opacity': 0.9,
      'text-background-padding': 2,
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
  // Highlighted edges (connected to selected node) - MUST come after type-specific styles
  {
    selector: 'edge.highlighted',
    style: {
      'width': 4,
      'opacity': 1,
      'line-color': '#ef4444',
      'target-arrow-color': '#ef4444',
      'z-index': 999,
      'label': 'data(tenure)',
      'font-size': 10,
      'font-weight': 600,
      'color': '#374151',
      'text-background-color': '#ffffff',
      'text-background-opacity': 0.95,
      'text-background-padding': 3,
      'text-background-shape': 'roundrectangle',
      'text-margin-y': -10,
    },
  },
  // Dimmed edges (not connected to selected)
  {
    selector: 'edge.dimmed',
    style: {
      'opacity': 0.15,
    },
  },
];

export function ArtistGraph({
  graph,
  onNodeClick,
  onNodeExpand,
  onNodeHover,
  selectedNodeId,
  hoveredNodeId,
  className = '',
  cyRef: externalCyRef,
  layoutType = 'auto',
  networkDepth = 1,
  onLayoutChange,
  filters,
}: ArtistGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const internalCyRef = useRef<Core | null>(null);
  const cyRef = externalCyRef || internalCyRef;
  const layoutRef = useRef<Layouts | null>(null);
  const isDestroyedRef = useRef(false);
  const [isLayouting, setIsLayouting] = useState(false);
  const [currentLayout, setCurrentLayout] = useState<LayoutType>(layoutType);

  /**
   * Callback refs pattern: Store callbacks in refs and update them on every render.
   * This allows the Cytoscape initialization useEffect to access the latest callbacks
   * without including them in the dependency array (which would cause Cytoscape to
   * reinitialize on every callback change, losing graph state and causing flickering).
   * The event handlers read from these refs, so they always call the current callback.
   */
  const onNodeClickRef = useRef(onNodeClick);
  const onNodeExpandRef = useRef(onNodeExpand);
  const onNodeHoverRef = useRef(onNodeHover);
  onNodeClickRef.current = onNodeClick;
  onNodeExpandRef.current = onNodeExpand;
  onNodeHoverRef.current = onNodeHover;

  // Layout display names for the dropdown (kept for potential future UI)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const layoutOptions: { value: LayoutType; label: string }[] = [
    { value: 'auto', label: 'Auto (Depth-based)' },
    { value: 'spoke', label: 'Spoke (Hub & Rings)' },
    { value: 'radial', label: 'Radial Tree' },
    { value: 'force', label: 'Force-Directed' },
    { value: 'hierarchical', label: 'Hierarchical' },
    { value: 'concentric', label: 'Concentric Rings' },
  ];

  // Convert our graph format to Cytoscape elements
  const convertToElements = useCallback(() => {
    const nodes = graph.nodes.map((node, index) => {
      return {
        data: {
          id: node.data.id,
          name: node.data.name,
          label: node.data.name,
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
        tenure: formatTenure(edge.data.period?.begin, edge.data.period?.end),
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
      const currentId = queue.shift();
      if (!currentId) continue;
      const currentDepth = depths.get(currentId) ?? 0;
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
    // Auto mode: Force at depth 1, Spoke at depth 2+
    return depth === 1 ? 'force' : 'spoke';
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
        // COSE force-directed layout - physics simulation with node repulsion
        return {
          name: 'cose',
          animate: true,
          animationDuration: 1000,
          animationEasing: 'ease-out',
          fit: true,
          padding: 30,
          // Physics simulation settings
          nodeRepulsion: () => isLarge ? 8000 : isMedium ? 12000 : 20000,
          nodeOverlap: 20,
          idealEdgeLength: () => isLarge ? 80 : isMedium ? 120 : 160,
          edgeElasticity: () => isLarge ? 80 : 100,
          nestingFactor: 1.2,
          gravity: 0.25,
          numIter: isLarge ? 500 : 1000,
          initialTemp: 200,
          coolingFactor: 0.95,
          minTemp: 1.0,
          randomize: true,
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
          spacingFactor: isLarge ? 0.4 : isMedium ? 0.5 : 0.6,
        } as unknown as cytoscape.LayoutOptions;

      case 'spoke': {
        // Custom spoke layout - hub with explicit rings based on BFS depth
        // This creates the visual pattern: Core -> Members -> Members' other bands
        const spokeDepths = cy ? calculateNodeDepths(cy) : new Map<string, number>();

        // Group nodes by depth
        const nodesByDepth = new Map<number, string[]>();
        spokeDepths.forEach((depth, nodeId) => {
          const existing = nodesByDepth.get(depth);
          if (existing) {
            existing.push(nodeId);
          } else {
            nodesByDepth.set(depth, [nodeId]);
          }
        });

        // Calculate positions for each node
        const positions: Record<string, { x: number; y: number }> = {};
        const containerWidth = containerRef.current?.clientWidth || 800;
        const containerHeight = containerRef.current?.clientHeight || 600;
        const centerX = containerWidth / 2;
        const centerY = containerHeight / 2;

        // Minimum spacing between nodes on a ring (accounts for node size + label)
        const minNodeSpacing = isLarge ? 50 : isMedium ? 60 : 70;
        // Minimum ring spacing
        const minRingSpacing = isLarge ? 80 : isMedium ? 100 : 120;

        // Calculate cumulative radius for each depth based on node counts
        let cumulativeRadius = 0;
        const ringRadii = new Map<number, number>();

        // Sort depths and calculate radii
        const sortedDepths = Array.from(nodesByDepth.keys()).sort((a, b) => a - b);

        sortedDepths.forEach((depth) => {
          if (depth === 0) {
            ringRadii.set(depth, 0);
          } else {
            const nodesAtDepth = nodesByDepth.get(depth)?.length || 1;
            // Calculate minimum radius needed to fit all nodes with proper spacing
            // Circumference = 2 * PI * r, so r = (nodeCount * spacing) / (2 * PI)
            const radiusForSpacing = (nodesAtDepth * minNodeSpacing) / (2 * Math.PI);
            // Use whichever is larger: minimum ring spacing or spacing-based radius
            const ringIncrement = Math.max(minRingSpacing, radiusForSpacing - cumulativeRadius + minRingSpacing);
            cumulativeRadius += ringIncrement;
            ringRadii.set(depth, cumulativeRadius);
          }
        });

        nodesByDepth.forEach((nodeIds, depth) => {
          if (depth === 0) {
            // Center node (hub)
            nodeIds.forEach(id => {
              positions[id] = { x: centerX, y: centerY };
            });
          } else {
            // Arrange nodes in a circle at this depth with calculated radius
            const radius = ringRadii.get(depth) || depth * minRingSpacing;
            const nodeCount = nodeIds.length;
            const angleStep = (2 * Math.PI) / nodeCount;
            const startAngle = -Math.PI / 2; // Start from top

            nodeIds.forEach((id, index) => {
              const angle = startAngle + (index * angleStep);
              positions[id] = {
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle),
              };
            });
          }
        });

        return {
          name: 'preset',
          positions: (node: NodeSingular) => {
            const pos = positions[node.id()];
            return pos || { x: centerX, y: centerY };
          },
          fit: true,
          padding: 50,
          animate: true,
          animationDuration: 500,
          animationEasing: 'ease-out',
        } as unknown as cytoscape.LayoutOptions;
      }

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

  // Sync internal layout state when layoutType prop changes from parent
  useEffect(() => {
    if (layoutType !== currentLayout) {
      handleLayoutChange(layoutType);
    }
  }, [layoutType, currentLayout, handleLayoutChange]);

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
      // Type assertion needed: cytoscape's types are overly strict for style values
      style: cytoscapeStyle as cytoscape.StylesheetStyle[],
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

      if (onNodeClickRef.current) {
        const artistNode: ArtistNode = {
          id: nodeData.id,
          name: nodeData.name,
          type: nodeData.type,
          loaded: nodeData.loaded === 'true',
        };
        onNodeClickRef.current(artistNode);
      }
    });

    // Double-click to expand
    cy.on('dbltap', 'node', (event) => {
      if (isDestroyedRef.current) return;
      const node = event.target as NodeSingular;
      const nodeData = node.data();

      if (nodeData.loaded === 'false' && onNodeExpandRef.current) {
        onNodeExpandRef.current(nodeData.id);
      }
    });

    // Background click to clear selection
    cy.on('tap', (event) => {
      if (isDestroyedRef.current) return;
      // Only trigger if clicking on background (not a node or edge)
      if (event.target === cy && onNodeClickRef.current) {
        onNodeClickRef.current(null);
      }
    });

    // Node hover handlers for bi-directional highlighting
    cy.on('mouseover', 'node', (event) => {
      if (isDestroyedRef.current) return;
      const node = event.target as NodeSingular;
      const nodeData = node.data();
      if (onNodeHoverRef.current) {
        onNodeHoverRef.current(nodeData.id);
      }
    });

    cy.on('mouseout', 'node', () => {
      if (isDestroyedRef.current) return;
      if (onNodeHoverRef.current) {
        onNodeHoverRef.current(null);
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
    // Intentionally omitting onNodeClick/onNodeExpand from deps: they're accessed via refs
    // (see callback refs pattern comment above) to prevent Cytoscape reinitialization.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convertToElements, getLayoutOptions]);

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

        // Check if this is the root node (main artist)
        const isRootNode = selectedNode.data('root') === 'true';

        if (isRootNode) {
          // Fully center on root node when clicked
          cy.animate({
            center: { eles: selectedNode },
            duration: 300,
            easing: 'ease-out',
          });
        } else {
          // Subtle pan towards selected node (only if it's far from center)
          const nodePos = selectedNode.position();
          const extent = cy.extent();
          const viewCenterX = (extent.x1 + extent.x2) / 2;
          const viewCenterY = (extent.y1 + extent.y2) / 2;
          const viewWidth = extent.x2 - extent.x1;
          const viewHeight = extent.y2 - extent.y1;

          // Only nudge if node is in outer region of viewport
          const distFromCenterX = Math.abs(nodePos.x - viewCenterX) / (viewWidth / 2);
          const distFromCenterY = Math.abs(nodePos.y - viewCenterY) / (viewHeight / 2);

          if (distFromCenterX > VIEWPORT_OUTER_THRESHOLD || distFromCenterY > VIEWPORT_OUTER_THRESHOLD) {
            // Pan partially toward the selected node
            const newCenterX = viewCenterX + (nodePos.x - viewCenterX) * PAN_DISTANCE_FACTOR;
            const newCenterY = viewCenterY + (nodePos.y - viewCenterY) * PAN_DISTANCE_FACTOR;
            cy.animate({
              pan: {
                x: cy.pan().x - (newCenterX - viewCenterX) * cy.zoom(),
                y: cy.pan().y - (newCenterY - viewCenterY) * cy.zoom(),
              },
              duration: 200,
              easing: 'ease-out',
            });
          }
        }
      }
    }
  }, [selectedNodeId]);

  // Update hover highlighting when hoveredNodeId changes
  useEffect(() => {
    if (!cyRef.current || isDestroyedRef.current) return;

    const cy = cyRef.current;

    // Clear previous hover state
    cy.nodes().removeClass('hovered');

    if (hoveredNodeId) {
      const hoveredNode = cy.$(`#${hoveredNodeId}`);
      if (hoveredNode.length) {
        hoveredNode.addClass('hovered');
      }
    }
  }, [hoveredNodeId]);

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

  // Apply filters to show/hide nodes and edges
  useEffect(() => {
    if (!cyRef.current || isDestroyedRef.current || !filters) return;

    const cy = cyRef.current;

    // Reset all elements to visible first
    cy.elements().removeClass('filtered');
    cy.elements().style('display', 'element');

    // Get the root node - always keep it visible
    const rootNode = cy.$('node[root = "true"]');
    const rootId = rootNode.id();

    // Filter edges by relationship type
    cy.edges().forEach(edge => {
      const edgeType = edge.data('type') as RelationshipType;
      if (!filters.relationshipTypes.has(edgeType)) {
        edge.addClass('filtered');
        edge.style('display', 'none');
      }
    });

    // Filter edges by temporal (current vs all time)
    if (filters.temporalFilter === 'current') {
      cy.edges().forEach(edge => {
        // Check if this edge has end date info in the original graph data
        const edgeData = graph.edges.find(e => e.data.id === edge.id());
        if (edgeData?.data.period?.end) {
          edge.addClass('filtered');
          edge.style('display', 'none');
        }
      });
    }

    // Filter edges by year range (if set)
    if (filters.yearRange) {
      const { min: filterMin, max: filterMax } = filters.yearRange;
      cy.edges().forEach(edge => {
        if (edge.hasClass('filtered')) return; // Already filtered out

        const edgeData = graph.edges.find(e => e.data.id === edge.id());
        if (edgeData?.data.period) {
          const period = edgeData.data.period;
          const beginYear = parseYear(period.begin);
          const endYear = parseYear(period.end);

          // If we have a begin date, check if it's after the filter range
          if (beginYear && beginYear > filterMax) {
            edge.addClass('filtered');
            edge.style('display', 'none');
            return;
          }

          // If we have an end date, check if it's before the filter range
          if (endYear && endYear < filterMin) {
            edge.addClass('filtered');
            edge.style('display', 'none');
            return;
          }
        }
        // If no period data, keep the edge visible (we don't know when it was)
      });
    }

    // Filter nodes by type (person vs group)
    cy.nodes().forEach(node => {
      // Never filter the root node
      if (node.id() === rootId) return;

      const nodeType = node.data('type') as 'person' | 'group';
      if (!filters.nodeTypes.has(nodeType)) {
        node.addClass('filtered');
        node.style('display', 'none');
        // Also hide connected edges
        node.connectedEdges().forEach(edge => {
          edge.addClass('filtered');
          edge.style('display', 'none');
        });
      }
    });

    // Hide orphan nodes (nodes with no visible edges, except root)
    cy.nodes().forEach(node => {
      if (node.id() === rootId) return;
      if (node.hasClass('filtered')) return;

      const visibleEdges = node.connectedEdges().filter(e => !e.hasClass('filtered'));
      if (visibleEdges.length === 0) {
        node.addClass('filtered');
        node.style('display', 'none');
      }
    });
  }, [filters, graph.edges]);

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
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur p-3 rounded-lg shadow-sm text-xs space-y-1 max-h-[calc(100%-6rem)] overflow-y-auto">
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
          <div className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-violet-500" />
          <span>Founding Member</span>
        </div>
        <div className="flex items-center gap-2 mt-2 pt-2 border-t">
          <div className="w-4 h-0.5 bg-blue-300" />
          <span>Member of</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-emerald-400 border-dashed" style={{ borderTopWidth: 2, borderTopStyle: 'dashed' }} />
          <span>Collaboration</span>
        </div>
        <div className="flex items-center gap-2 mt-2 pt-2 border-t">
          <div className="w-3 h-3 rounded-full border-2 border-red-500 bg-red-50" />
          <span>Selected</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 bg-red-500" style={{ height: 3 }} />
          <span>Selected connection</span>
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
