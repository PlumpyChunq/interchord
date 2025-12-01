'use client';

import { useRef, useCallback, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react';

interface CollapsibleSectionProps {
  id: string;
  title: string;
  count?: number;
  isCollapsed: boolean;
  onToggle: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  children: React.ReactNode;
  /** Index for drag-and-drop */
  index: number;
  /** Called when drag starts */
  onDragStart?: (index: number) => void;
  /** Called when item is dropped on this section */
  onDrop?: (fromIndex: number, toIndex: number, position: 'above' | 'below') => void;
  /** Called when drag ends without drop */
  onDragEnd?: () => void;
  /** Whether this item is being dragged */
  isDragging?: boolean;
}

export function CollapsibleSection({
  title,
  count,
  isCollapsed,
  onToggle,
  onMoveUp,
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true,
  children,
  index,
  onDragStart,
  onDrop,
  onDragEnd,
  isDragging,
}: CollapsibleSectionProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'above' | 'below' | null>(null);
  const [isDraggedOver, setIsDraggedOver] = useState(false);

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
      if (cardRef.current) {
        e.dataTransfer.setDragImage(cardRef.current, 0, 0);
      }
      onDragStart?.(index);
    },
    [index, onDragStart]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setIsDraggedOver(true);

      const rect = cardRef.current?.getBoundingClientRect();
      if (rect) {
        const midpoint = rect.top + rect.height / 2;
        setDragOverPosition(e.clientY < midpoint ? 'above' : 'below');
      }
    },
    []
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if we're actually leaving the element (not entering a child)
    if (!cardRef.current?.contains(e.relatedTarget as Node)) {
      setDragOverPosition(null);
      setIsDraggedOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
      if (!isNaN(fromIndex) && dragOverPosition) {
        onDrop?.(fromIndex, index, dragOverPosition);
      }
      setDragOverPosition(null);
      setIsDraggedOver(false);
    },
    [index, dragOverPosition, onDrop]
  );

  const handleDragEnd = useCallback(() => {
    setDragOverPosition(null);
    setIsDraggedOver(false);
    onDragEnd?.();
  }, [onDragEnd]);

  // Collapsed: minimal single-line bar
  if (isCollapsed) {
    return (
      <div className="relative">
        {isDraggedOver && dragOverPosition === 'above' && (
          <div className="absolute -top-1 left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10" />
        )}
        <div
          ref={cardRef}
          draggable
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex items-center gap-1.5 py-1 px-2 bg-gray-100 rounded border border-gray-200 cursor-grab active:cursor-grabbing select-none transition-all ${
            isDragging ? 'opacity-40 scale-95' : 'hover:bg-gray-150'
          }`}
        >
          <GripVertical className="w-3 h-3 text-gray-400 flex-shrink-0" />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="flex items-center gap-1 flex-1 text-left hover:text-blue-600 transition-colors min-w-0"
          >
            <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
            <span className="text-xs font-medium text-gray-600 truncate">{title}</span>
            {count !== undefined && (
              <span className="text-[10px] text-gray-400 flex-shrink-0">({count})</span>
            )}
          </button>
        </div>
        {isDraggedOver && dragOverPosition === 'below' && (
          <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10" />
        )}
      </div>
    );
  }

  // Expanded: full card with content
  return (
    <div className="relative">
      {isDraggedOver && dragOverPosition === 'above' && (
        <div className="absolute -top-1 left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10" />
      )}

      <Card
        ref={cardRef}
        className={`text-sm transition-all ${isDragging ? 'opacity-40 scale-95' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div
          draggable
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          className="flex items-center gap-1 py-1.5 px-2 cursor-grab active:cursor-grabbing select-none"
        >
          <GripVertical className="w-3 h-3 text-gray-300 flex-shrink-0" />

          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="flex items-center gap-1 flex-1 text-left hover:text-blue-600 transition-colors min-w-0"
          >
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span className="text-sm font-medium truncate">{title}</span>
            {count !== undefined && (
              <span className="text-xs font-normal text-gray-400 flex-shrink-0">({count})</span>
            )}
          </button>

          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoveUp?.();
              }}
              disabled={!canMoveUp}
              className={`p-0.5 rounded transition-colors ${
                canMoveUp
                  ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  : 'text-gray-200 cursor-not-allowed'
              }`}
              title="Move up"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoveDown?.();
              }}
              disabled={!canMoveDown}
              className={`p-0.5 rounded transition-colors ${
                canMoveDown
                  ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  : 'text-gray-200 cursor-not-allowed'
              }`}
              title="Move down"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        <CardContent className="py-2 px-3 pt-0">
          {children}
        </CardContent>
      </Card>

      {isDraggedOver && dragOverPosition === 'below' && (
        <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10" />
      )}
    </div>
  );
}
