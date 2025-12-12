/**
 * Cytoscape layout configurations for the artist relationship graph.
 *
 * This module provides layout options for different visualization modes:
 * - force: Live physics simulation with cola (nodes react to each other)
 * - hierarchical: Tree structure using dagre (top to bottom)
 * - concentric: Rings based on BFS depth from root
 * - spoke: Custom hub-and-rings layout with explicit ring placement
 * - radial: Breadthfirst circle layout
 */

import type cytoscape from 'cytoscape';
import type { Core, NodeSingular } from 'cytoscape';

// Layout types available to users
export type LayoutType = 'auto' | 'radial' | 'force' | 'hierarchical' | 'concentric' | 'spoke';

// Layout display names for UI dropdowns
export const LAYOUT_OPTIONS: { value: LayoutType; label: string }[] = [
  { value: 'auto', label: 'Auto (Depth-based)' },
  { value: 'spoke', label: 'Spoke (Hub & Rings)' },
  { value: 'radial', label: 'Radial Tree' },
  { value: 'force', label: 'Force-Directed' },
  { value: 'hierarchical', label: 'Hierarchical' },
  { value: 'concentric', label: 'Concentric Rings' },
];

/**
 * Calculate BFS depth from root node for each node.
 * Used by concentric and spoke layouts to determine ring placement.
 */
export function calculateNodeDepths(cy: Core): Map<string, number> {
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
}

/**
 * Determine effective layout based on 'auto' mode and network depth.
 * Auto mode uses Force at depth 1, Spoke at depth 2+.
 */
export function getEffectiveLayout(layout: LayoutType, depth: number): Exclude<LayoutType, 'auto'> {
  if (layout !== 'auto') return layout;
  return depth === 1 ? 'force' : 'spoke';
}

/**
 * Configuration options for layout generation
 */
export interface LayoutConfig {
  nodeCount: number;
  cy?: Core;
  layout: LayoutType;
  networkDepth: number;
  containerWidth: number;
  containerHeight: number;
}

/**
 * Get layout options for the specified layout type.
 */
export function getLayoutOptions(config: LayoutConfig): cytoscape.LayoutOptions {
  const { nodeCount, cy, layout, networkDepth, containerWidth, containerHeight } = config;

  const isLarge = nodeCount > 100;
  const isMedium = nodeCount > 30;
  const effectiveLayout = getEffectiveLayout(layout, networkDepth);
  const rootNode = cy?.$('node[root = "true"]').first();
  const rootId = rootNode?.id();

  switch (effectiveLayout) {
    case 'force':
      // Cola force-directed layout - LIVE physics simulation
      // Nodes continuously react to each other when dragged
      // Locked nodes (via node.lock()) are treated as immovable anchors
      return {
        name: 'cola',
        animate: true,
        infinite: true,  // KEY: Keeps simulation running forever
        fit: false,  // Don't continuously fit - allows user zoom/pan
        padding: 30,
        // Node spacing - how far apart nodes try to stay
        nodeSpacing: () => isLarge ? 20 : isMedium ? 30 : 40,
        // Edge length - ideal distance between connected nodes
        edgeLength: () => isLarge ? 100 : isMedium ? 150 : 200,
        // Prevent node overlap
        avoidOverlap: true,
        // How much nodes repel each other (higher = more spread)
        edgeSymDiffLength: isLarge ? 10 : 20,
        // Alignment constraint strength
        alignment: undefined,
        // Flow direction (undefined = no constraint)
        flow: undefined,
        // Unconstraint iterations (initial spreading)
        unconstrIter: isLarge ? 10 : 20,
        // User constraint iterations
        userConstIter: 0,
        // All constraint iterations
        allConstIter: isLarge ? 10 : 20,
        // Randomize initial positions for better spreading
        randomize: false,
        // Center the graph
        centerGraph: true,
        // Handle disconnected components
        handleDisconnected: true,
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

    case 'concentric': {
      // Concentric layout - rings based on depth
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
    }

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
}
