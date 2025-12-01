'use client';

import { useMemo } from 'react';
import type { RelationshipType } from '@/types';

export interface GraphFilterState {
  relationshipTypes: Set<RelationshipType>;
  temporalFilter: 'all' | 'current';
  nodeTypes: Set<'person' | 'group'>;
}

interface GraphFiltersProps {
  filters: GraphFilterState;
  onFiltersChange: (filters: GraphFilterState) => void;
  availableTypes?: RelationshipType[];
  compact?: boolean;
}

// Configuration for each relationship type - colors match graph edge colors
const RELATIONSHIP_CONFIG: Record<RelationshipType, { label: string; color: string; defaultOn: boolean }> = {
  member_of: { label: 'Member', color: '#93c5fd', defaultOn: true },
  founder_of: { label: 'Founder', color: '#fcd34d', defaultOn: true },
  side_project: { label: 'Side Project', color: '#f9a8d4', defaultOn: true },
  collaboration: { label: 'Collab', color: '#6ee7b7', defaultOn: true },
  producer: { label: 'Producer', color: '#c4b5fd', defaultOn: true },
  touring_member: { label: 'Touring', color: '#9ca3af', defaultOn: false },
  same_label: { label: 'Label', color: '#9ca3af', defaultOn: false },
  same_scene: { label: 'Scene', color: '#9ca3af', defaultOn: false },
  influenced_by: { label: 'Influence', color: '#9ca3af', defaultOn: false },
};

// Default filter state
export function getDefaultFilters(): GraphFilterState {
  const defaultTypes = new Set<RelationshipType>();
  for (const [type, config] of Object.entries(RELATIONSHIP_CONFIG)) {
    if (config.defaultOn) {
      defaultTypes.add(type as RelationshipType);
    }
  }

  return {
    relationshipTypes: defaultTypes,
    temporalFilter: 'all',
    nodeTypes: new Set(['person', 'group']),
  };
}

export function GraphFilters({
  filters,
  onFiltersChange,
  availableTypes,
  compact = false,
}: GraphFiltersProps) {
  // Filter to only show types that exist in the graph
  const visibleTypes = useMemo(() => {
    const allTypes = Object.keys(RELATIONSHIP_CONFIG) as RelationshipType[];
    if (!availableTypes || availableTypes.length === 0) return allTypes;
    return allTypes.filter(type => availableTypes.includes(type));
  }, [availableTypes]);

  const handleRelTypeToggle = (type: RelationshipType) => {
    const newTypes = new Set(filters.relationshipTypes);
    if (newTypes.has(type)) {
      newTypes.delete(type);
    } else {
      newTypes.add(type);
    }
    onFiltersChange({ ...filters, relationshipTypes: newTypes });
  };

  const handleTemporalChange = (value: 'all' | 'current') => {
    onFiltersChange({ ...filters, temporalFilter: value });
  };

  const handleNodeTypeToggle = (type: 'person' | 'group') => {
    const newTypes = new Set(filters.nodeTypes);
    if (newTypes.has(type)) {
      // Don't allow deselecting both
      if (newTypes.size > 1) {
        newTypes.delete(type);
      }
    } else {
      newTypes.add(type);
    }
    onFiltersChange({ ...filters, nodeTypes: newTypes });
  };

  const handleSelectAll = () => {
    onFiltersChange({
      ...filters,
      relationshipTypes: new Set(visibleTypes),
    });
  };

  const handleSelectNone = () => {
    // Keep at least one type selected
    const firstType = visibleTypes[0];
    onFiltersChange({
      ...filters,
      relationshipTypes: new Set([firstType]),
    });
  };

  if (compact) {
    const handleReset = () => {
      onFiltersChange(getDefaultFilters());
    };

    // Check if current filters differ from defaults
    const defaults = getDefaultFilters();
    const isModified =
      filters.temporalFilter !== defaults.temporalFilter ||
      filters.relationshipTypes.size !== defaults.relationshipTypes.size ||
      ![...filters.relationshipTypes].every(t => defaults.relationshipTypes.has(t));

    return (
      <div className="flex items-center gap-1 flex-wrap text-[10px]">
        {visibleTypes.map((type) => {
          const config = RELATIONSHIP_CONFIG[type];
          const isActive = filters.relationshipTypes.has(type);
          return (
            <button
              key={type}
              onClick={() => handleRelTypeToggle(type)}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded border transition-all ${
                isActive
                  ? 'border-current'
                  : 'border-transparent opacity-30 hover:opacity-60'
              }`}
              style={isActive ? {
                backgroundColor: `${config.color}20`,
                borderColor: config.color,
                color: config.color,
              } : undefined}
              title={`${isActive ? 'Hide' : 'Show'} ${config.label} relationships`}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: config.color }}
              />
              <span style={isActive ? { color: '#374151' } : undefined}>{config.label}</span>
            </button>
          );
        })}
        <span className="text-gray-200">|</span>
        <button
          onClick={() => handleTemporalChange(filters.temporalFilter === 'all' ? 'current' : 'all')}
          className={`px-1.5 py-0.5 rounded border transition-all ${
            filters.temporalFilter === 'current'
              ? 'border-green-400 bg-green-100 text-green-700'
              : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-100'
          }`}
          title={filters.temporalFilter === 'current' ? 'Showing current members only' : 'Showing all members (past + present)'}
        >
          {filters.temporalFilter === 'current' ? 'Current' : 'All Time'}
        </button>
        <button
          onClick={handleSelectAll}
          className="px-1.5 py-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          title="Show all relationship types"
        >
          All
        </button>
        <button
          onClick={handleSelectNone}
          className="px-1.5 py-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          title="Clear all filters (keeps only Member)"
        >
          Clear
        </button>
        {isModified && (
          <button
            onClick={handleReset}
            className="px-1.5 py-0.5 rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
            title="Reset filters to defaults"
          >
            Reset
          </button>
        )}
      </div>
    );
  }

  // Check if current filters differ from defaults for the reset button
  const defaults = getDefaultFilters();
  const isModified =
    filters.temporalFilter !== defaults.temporalFilter ||
    filters.relationshipTypes.size !== defaults.relationshipTypes.size ||
    ![...filters.relationshipTypes].every(t => defaults.relationshipTypes.has(t)) ||
    filters.nodeTypes.size !== defaults.nodeTypes.size ||
    ![...filters.nodeTypes].every(t => defaults.nodeTypes.has(t));

  const handleReset = () => {
    onFiltersChange(getDefaultFilters());
  };

  return (
    <div className="bg-white border rounded-lg p-3 space-y-3 text-sm">
      {/* Relationship Types */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium text-gray-700">Relationship Types</span>
          <div className="flex gap-1">
            <button
              onClick={handleSelectAll}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              All
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={handleSelectNone}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              None
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {visibleTypes.map((type) => {
            const config = RELATIONSHIP_CONFIG[type];
            const isActive = filters.relationshipTypes.has(type);
            return (
              <label
                key={type}
                className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer transition-colors border ${
                  isActive ? '' : 'border-transparent hover:bg-gray-50 opacity-50'
                }`}
                style={isActive ? {
                  backgroundColor: `${config.color}20`,
                  borderColor: config.color,
                } : undefined}
              >
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={() => handleRelTypeToggle(type)}
                  className="sr-only"
                />
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: isActive ? config.color : '#d1d5db' }}
                />
                <span className={isActive ? 'text-gray-900' : 'text-gray-400'}>
                  {config.label}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Temporal Filter */}
      <div className="border-t pt-3">
        <span className="font-medium text-gray-700 block mb-2">Time Period</span>
        <div className="flex gap-2">
          <button
            onClick={() => handleTemporalChange('all')}
            className={`flex-1 px-3 py-1.5 rounded border transition-colors ${
              filters.temporalFilter === 'all'
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            All Time
          </button>
          <button
            onClick={() => handleTemporalChange('current')}
            className={`flex-1 px-3 py-1.5 rounded border transition-colors ${
              filters.temporalFilter === 'current'
                ? 'bg-green-500 text-white border-green-500'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Current Only
          </button>
        </div>
      </div>

      {/* Node Type Filter */}
      <div className="border-t pt-3">
        <span className="font-medium text-gray-700 block mb-2">Show</span>
        <div className="flex gap-2">
          <label
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded border cursor-pointer transition-colors ${
              filters.nodeTypes.has('person')
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : 'bg-white text-gray-400 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <input
              type="checkbox"
              checked={filters.nodeTypes.has('person')}
              onChange={() => handleNodeTypeToggle('person')}
              className="sr-only"
            />
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span>Persons</span>
          </label>
          <label
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded border cursor-pointer transition-colors ${
              filters.nodeTypes.has('group')
                ? 'bg-blue-100 text-blue-800 border-blue-300'
                : 'bg-white text-gray-400 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <input
              type="checkbox"
              checked={filters.nodeTypes.has('group')}
              onChange={() => handleNodeTypeToggle('group')}
              className="sr-only"
            />
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span>Groups</span>
          </label>
        </div>
      </div>

      {/* Reset Button */}
      {isModified && (
        <div className="border-t pt-3">
          <button
            onClick={handleReset}
            className="w-full px-3 py-1.5 rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors text-sm"
          >
            Reset All Filters
          </button>
        </div>
      )}
    </div>
  );
}
