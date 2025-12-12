/**
 * Cytoscape stylesheet configuration for the artist relationship graph.
 *
 * This module exports theme-aware styles for nodes and edges in the graph.
 * Styles are organized by element type and state (selected, highlighted, dimmed, etc.)
 */

import type cytoscape from 'cytoscape';

// Type for Cytoscape style value (can be string, number, or function)
type StyleValue = string | number | ((ele: cytoscape.SingularElementArgument) => string | number);

// Interface for a single style rule
interface StyleRule {
  selector: string;
  style: Record<string, StyleValue>;
}

/**
 * Returns theme-aware Cytoscape styles.
 *
 * @param isDark - Whether dark mode is active
 * @returns Array of style rules for Cytoscape
 */
export function getCytoscapeStyle(isDark: boolean): StyleRule[] {
  return [
    // ==========================================
    // NODE BASE STYLES
    // ==========================================
    {
      selector: 'node',
      style: {
        'label': 'data(label)',
        'text-valign': 'bottom',
        'text-halign': 'center',
        'text-margin-y': 8,
        'font-size': 10,
        'font-weight': 500,
        'color': isDark ? '#e5e7eb' : '#374151',
        'text-outline-color': isDark ? '#3d1515' : '#ffffff',
        'text-outline-width': 2,
        'background-color': '#6b7280',
        'border-width': 2,
        'border-color': isDark ? '#4b5563' : '#ffffff',
        'width': 35,
        'height': 35,
        'transition-property': 'background-color, border-color, width, height',
        'transition-duration': 200,
        'overlay-opacity': 0,
        'text-wrap': 'wrap',
        'text-max-width': 100,
      },
    },

    // ==========================================
    // NODE TYPE STYLES
    // ==========================================

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

    // ==========================================
    // NODE STATE STYLES
    // ==========================================

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

    // ==========================================
    // SPECIAL NODE STYLES
    // ==========================================

    // Root/center node - MUCH larger and prominent with cyan glow
    // This is the "searched artist" - the focus of the current view
    {
      selector: 'node[root = "true"]',
      style: {
        'width': 80,
        'height': 80,
        'font-size': 14,
        'font-weight': 700,
        'border-width': 6,
        'border-color': '#06b6d4',
        'background-color': '#2563eb',
        // Cyan glow effect to indicate "this is the searched artist"
        'overlay-color': '#06b6d4',
        'overlay-opacity': 0.15,
        'overlay-padding': 8,
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

    // ==========================================
    // EDGE BASE STYLES
    // ==========================================
    {
      selector: 'edge',
      style: {
        'width': 1.5,
        'line-color': isDark ? '#4b5563' : '#d1d5db',
        'target-arrow-color': isDark ? '#4b5563' : '#d1d5db',
        'target-arrow-shape': 'triangle',
        'arrow-scale': 0.8,
        'curve-style': 'bezier',
        'opacity': 0.6,
        'label': '',  // No label by default
        'font-size': 9,
        'text-background-color': isDark ? '#1f2937' : '#ffffff',
        'text-background-opacity': 0.9,
        'text-background-padding': 2,
      },
    },

    // ==========================================
    // EDGE TYPE STYLES
    // ==========================================
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

    // ==========================================
    // EDGE STATE STYLES
    // ==========================================

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
        'color': isDark ? '#e5e7eb' : '#374151',
        'text-background-color': isDark ? '#1f2937' : '#ffffff',
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
}
