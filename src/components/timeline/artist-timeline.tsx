'use client';

import { useRef, useState, useCallback, useMemo, useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { TimelineEvent, TimelineEventType } from '@/types';
import { TimelineEventPopup } from './timeline-event-popup';

interface ArtistTimelineProps {
  events: TimelineEvent[];
  isLoading: boolean;
  yearRange: { min: number; max: number } | null;
  /** Called when clicking a timeline event (for selection) */
  onHighlightArtists?: (artistIds: string[]) => void;
  /** Called when hovering over a timeline event (for bi-directional highlighting) */
  onHoverArtists?: (artistIds: string[]) => void;
  /** Called when hovering over an album event (for bi-directional highlighting with sidebar) */
  onHoverAlbum?: (albumName: string | null, year: number | null, source?: 'timeline' | 'sidebar') => void;
  highlightedAlbum?: { name: string; year: number } | null;
  highlightedArtistIds?: string[];
  onHeightChange?: (height: number) => void;
  /** Filter year range from graph filters - shows visual overlay */
  filterYearRange?: { min: number; max: number } | null;
}

export const TIMELINE_MIN_HEIGHT = 80;
export const TIMELINE_MAX_HEIGHT = 400;
export const TIMELINE_DEFAULT_HEIGHT = 112;

const EVENT_COLORS: Record<TimelineEventType, { bg: string; border: string; text: string }> = {
  album: { bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-700' },
  concert: { bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-700' },
  birth: { bg: 'bg-teal-100', border: 'border-teal-400', text: 'text-teal-700' },
  formation: { bg: 'bg-green-100', border: 'border-green-500', text: 'text-green-700' },
  disbanded: { bg: 'bg-red-100', border: 'border-red-400', text: 'text-red-700' },
  member_join: { bg: 'bg-emerald-100', border: 'border-emerald-400', text: 'text-emerald-700' },
  member_leave: { bg: 'bg-orange-100', border: 'border-orange-400', text: 'text-orange-700' },
  member_death: { bg: 'bg-gray-200', border: 'border-gray-500', text: 'text-gray-700' },
};

const EVENT_ICONS: Record<TimelineEventType, string> = {
  album: '💿',
  concert: '🎤',
  birth: '👶',
  formation: '🎸',
  disbanded: '🔚',
  member_join: '➕',
  member_leave: '➖',
  member_death: '☠️',
};

// Subscribe function that never calls callback (no external store changes)
const emptySubscribe = () => () => {};

// Portal component for tooltip that escapes overflow:hidden
function TooltipPortal({ children }: { children: React.ReactNode }) {
  // useSyncExternalStore is the recommended way to handle SSR hydration checks
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,  // Client value
    () => false  // Server value
  );

  if (!isClient) return null;

  return createPortal(children, document.body);
}

export function ArtistTimeline({
  events,
  isLoading,
  yearRange,
  onHighlightArtists,
  onHoverArtists,
  onHoverAlbum,
  highlightedAlbum,
  highlightedArtistIds,
  onHeightChange,
  filterYearRange,
}: ArtistTimelineProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);

  // Resizable height state
  const [height, setHeight] = useState(TIMELINE_DEFAULT_HEIGHT);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  // Notify parent of height changes
  useEffect(() => {
    onHeightChange?.(height);
  }, [height, onHeightChange]);

  // Handle resize drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartHeight.current = height;
  }, [height]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Since timeline is at bottom, dragging up (negative delta) should increase height
      const delta = dragStartY.current - e.clientY;
      const newHeight = Math.min(TIMELINE_MAX_HEIGHT, Math.max(TIMELINE_MIN_HEIGHT, dragStartHeight.current + delta));
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Group events by year
  const eventsByYear = useMemo(() => {
    const grouped = new Map<number, TimelineEvent[]>();
    for (const event of events) {
      const year = event.year;
      if (!grouped.has(year)) {
        grouped.set(year, []);
      }
      grouped.get(year)!.push(event);
    }
    return grouped;
  }, [events]);

  // Get all years in range
  const years = useMemo(() => {
    if (!yearRange) return [];
    const result: number[] = [];
    for (let y = yearRange.min; y <= yearRange.max; y++) {
      result.push(y);
    }
    return result;
  }, [yearRange]);

  // Find the center of music career (based on album events, not birth)
  const musicCareerCenter = useMemo(() => {
    const albumEvents = events.filter(e => e.type === 'album');
    if (albumEvents.length === 0) return null;
    const albumYears = albumEvents.map(e => e.year);
    const minYear = Math.min(...albumYears);
    const maxYear = Math.max(...albumYears);
    return Math.round((minYear + maxYear) / 2);
  }, [events]);

  // Scroll to center of music career on initial load
  const hasScrolledRef = useRef(false);
  useEffect(() => {
    if (hasScrolledRef.current || !scrollContainerRef.current || !musicCareerCenter || years.length === 0) return;

    // Find the index of the center year
    const centerIndex = years.indexOf(musicCareerCenter);
    if (centerIndex === -1) return;

    // Calculate scroll position (60px per year column, center in viewport)
    const columnWidth = 60;
    const containerWidth = scrollContainerRef.current.clientWidth;
    const scrollPosition = (centerIndex * columnWidth) - (containerWidth / 2) + (columnWidth / 2);

    scrollContainerRef.current.scrollLeft = Math.max(0, scrollPosition);
    hasScrolledRef.current = true;
  }, [musicCareerCenter, years]);

  const handleEventClick = useCallback(
    (event: TimelineEvent, e: React.MouseEvent) => {
      e.stopPropagation();
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      setSelectedEvent(event);
      setPopupPosition({
        x: rect.left + rect.width / 2,
        y: rect.top,
      });

      // Highlight related artists in graph
      if (onHighlightArtists && event.relatedArtistIds?.length) {
        onHighlightArtists(event.relatedArtistIds);
      }
    },
    [onHighlightArtists]
  );

  const handleClosePopup = useCallback(() => {
    setSelectedEvent(null);
    setPopupPosition(null);
    // Clear highlights
    if (onHighlightArtists) {
      onHighlightArtists([]);
    }
  }, [onHighlightArtists]);

  if (!yearRange && !isLoading) {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-lg z-40">
        {/* Resize handle */}
        <div
          onMouseDown={handleMouseDown}
          className={`absolute top-0 left-0 right-0 h-2 cursor-ns-resize group flex items-center justify-center
            ${isDragging ? 'bg-blue-100' : 'hover:bg-gray-100'} transition-colors`}
        >
          {/* Visual indicator - 3 horizontal lines */}
          <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-8 h-0.5 bg-gray-400 rounded-full" />
            <div className="w-8 h-0.5 bg-gray-400 rounded-full" />
          </div>
        </div>

        <div style={{ height: `${height}px` }} className="pt-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center gap-2 text-gray-500">
                <LoadingSpinner className="w-4 h-4" />
                <span className="text-sm">Loading timeline...</span>
              </div>
            </div>
          ) : events.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              No timeline events available
            </div>
          ) : (
            <div className="h-full flex flex-col">
              {/* Timeline header */}
              <div className="px-4 py-1 border-b border-gray-100 flex items-center gap-4 text-xs text-gray-500 shrink-0">
                <span className="font-medium">Timeline</span>
                <span>{yearRange?.min} - {yearRange?.max}</span>
                <span className="text-gray-300">|</span>
                <span>{events.length} events</span>
                <div className="flex items-center gap-3 ml-auto">
                  <LegendItem type="album" />
                  <LegendItem type="concert" />
                  <LegendItem type="formation" />
                  <LegendItem type="member_join" />
                  <LegendItem type="member_death" />
                </div>
              </div>

              {/* Timeline content - scrollable events area */}
              <div
                ref={scrollContainerRef}
                className="flex-1 overflow-x-auto overflow-y-hidden"
                style={{ scrollbarWidth: 'none' }}
              >
                <div
                  className="flex min-w-max px-4 gap-0 h-full items-end pb-1"
                >
                  {years.map((year) => (
                    <EventColumn
                      key={year}
                      year={year}
                      events={eventsByYear.get(year) || []}
                      onEventClick={handleEventClick}
                      onEventHover={onHoverArtists}
                      onHoverAlbum={onHoverAlbum}
                      highlightedAlbum={highlightedAlbum}
                      highlightedArtistIds={highlightedArtistIds}
                      isInFilterRange={!filterYearRange || (year >= filterYearRange.min && year <= filterYearRange.max)}
                      isFilterBoundaryStart={filterYearRange?.min === year}
                      isFilterBoundaryEnd={filterYearRange?.max === year}
                    />
                  ))}
                </div>
              </div>

              {/* Fixed year axis at bottom - synced scroll */}
              <div
                className="shrink-0 border-t border-gray-100 overflow-x-auto bg-white"
                style={{ scrollbarWidth: 'thin' }}
                onScroll={(e) => {
                  if (scrollContainerRef.current) {
                    scrollContainerRef.current.scrollLeft = e.currentTarget.scrollLeft;
                  }
                }}
                ref={(el) => {
                  // Sync scroll from main container to year axis
                  if (el && scrollContainerRef.current) {
                    scrollContainerRef.current.onscroll = () => {
                      el.scrollLeft = scrollContainerRef.current!.scrollLeft;
                    };
                  }
                }}
              >
                <div className="flex min-w-max px-4 gap-0 py-1">
                  {years.map((year) => {
                    const hasEvents = eventsByYear.has(year);
                    const isInFilterRange = !filterYearRange || (year >= filterYearRange.min && year <= filterYearRange.max);
                    const isBoundaryStart = filterYearRange?.min === year;
                    const isBoundaryEnd = filterYearRange?.max === year;
                    const isBoundary = isBoundaryStart || isBoundaryEnd;
                    return (
                      <div key={year} className={`min-w-[60px] text-center transition-opacity relative ${isInFilterRange ? '' : 'opacity-30'}`}>
                        {/* Boundary line extending into year axis */}
                        {isBoundaryStart && (
                          <div className="absolute left-0 top-0 bottom-0 w-px bg-blue-400/50" />
                        )}
                        {isBoundaryEnd && (
                          <div className="absolute right-0 top-0 bottom-0 w-px bg-blue-400/50" />
                        )}
                        <span className={`text-xs ${
                          isBoundary
                            ? 'font-bold text-blue-600'
                            : isInFilterRange
                              ? hasEvents ? 'font-medium text-gray-700' : 'font-medium text-gray-300'
                              : 'font-medium text-gray-400'
                        }`}>
                          {year}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Event popup */}
      {selectedEvent && popupPosition && (
        <TimelineEventPopup
          event={selectedEvent}
          position={popupPosition}
          onClose={handleClosePopup}
        />
      )}
    </>
  );
}

interface EventColumnProps {
  year: number;
  events: TimelineEvent[];
  onEventClick: (event: TimelineEvent, e: React.MouseEvent) => void;
  onEventHover?: (artistIds: string[]) => void;
  onHoverAlbum?: (albumName: string | null, year: number | null, source?: 'timeline' | 'sidebar') => void;
  highlightedAlbum?: { name: string; year: number } | null;
  highlightedArtistIds?: string[];
  isInFilterRange: boolean;
  isFilterBoundaryStart?: boolean;
  isFilterBoundaryEnd?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- year kept in props for potential future use
function EventColumn({ year, events, onEventClick, onEventHover, onHoverAlbum, highlightedAlbum, highlightedArtistIds, isInFilterRange, isFilterBoundaryStart, isFilterBoundaryEnd }: EventColumnProps) {
  const hasEvents = events.length > 0;

  return (
    <div className={`flex flex-col items-center justify-end min-w-[60px] relative transition-opacity ${isInFilterRange ? '' : 'opacity-30'}`}>
      {/* Filter boundary line - start */}
      {isFilterBoundaryStart && (
        <div className="absolute left-0 top-0 bottom-0 w-px bg-blue-400/50 z-20" />
      )}
      {/* Filter boundary line - end */}
      {isFilterBoundaryEnd && (
        <div className="absolute right-0 top-0 bottom-0 w-px bg-blue-400/50 z-20" />
      )}
      {/* Track line */}
      <div className={`absolute left-0 right-0 h-0.5 bottom-0 ${isInFilterRange ? 'bg-gray-200' : 'bg-gray-300'}`} />

      {/* Events */}
      {hasEvents ? (
        <div className="relative flex gap-0.5 z-10 mb-[-3px]">
          {events.slice(0, 5).map((event) => {
            // Check if event is highlighted via album
            const isAlbumHighlighted = highlightedAlbum &&
              event.type === 'album' &&
              event.year === highlightedAlbum.year &&
              event.title.toLowerCase().includes(highlightedAlbum.name.toLowerCase().substring(0, 10));

            // Check if event is highlighted via artist (event involves this artist)
            const isArtistHighlighted = !!(highlightedArtistIds?.length &&
              event.relatedArtistIds?.some(id => highlightedArtistIds.includes(id)));

            return (
              <EventDot
                key={event.id}
                event={event}
                onClick={onEventClick}
                onHover={onEventHover}
                onHoverAlbum={onHoverAlbum}
                isHighlighted={isAlbumHighlighted || isArtistHighlighted}
              />
            );
          })}
          {events.length > 5 && (
            <span className="text-[10px] text-gray-400 ml-1">+{events.length - 5}</span>
          )}
        </div>
      ) : (
        <div className="w-1.5 h-1.5 rounded-full bg-gray-200 z-10 mb-[-3px]" />
      )}
    </div>
  );
}

interface EventDotProps {
  event: TimelineEvent;
  onClick: (event: TimelineEvent, e: React.MouseEvent) => void;
  onHover?: (artistIds: string[]) => void;
  onHoverAlbum?: (albumName: string | null, year: number | null, source?: 'timeline' | 'sidebar') => void;
  isHighlighted?: boolean;
}

function EventDot({ event, onClick, onHover, onHoverAlbum, isHighlighted }: EventDotProps) {
  const colors = EVENT_COLORS[event.type];
  const icon = EVENT_ICONS[event.type];
  const isAlbum = event.type === 'album';
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [labelPos, setLabelPos] = useState<{ x: number; y: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const rafRef = useRef<number | undefined>(undefined);

  // Continuously update label position using requestAnimationFrame
  useEffect(() => {
    if (!isAlbum) return;

    const updateLabelPos = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setLabelPos({
          x: rect.left + rect.width / 2, // Center of icon
          y: rect.top - 24, // Well above the icon with visible gap
        });
      }
      rafRef.current = requestAnimationFrame(updateLabelPos);
    };

    rafRef.current = requestAnimationFrame(updateLabelPos);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isAlbum]);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setTooltipPos({
        x: rect.left + rect.width / 2,
        y: rect.top - 8,
      });
    }
    // Trigger hover highlight in graph and sidebar
    if (onHover && event.relatedArtistIds?.length) {
      onHover(event.relatedArtistIds);
    }
    // Trigger album highlight for bi-directional highlighting with sidebar
    if (onHoverAlbum && event.type === 'album') {
      onHoverAlbum(event.title, event.year, 'timeline');
    }
  }, [onHover, onHoverAlbum, event.relatedArtistIds, event.type, event.title, event.year]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setTooltipPos(null);
    // Clear hover highlight
    if (onHover) {
      onHover([]);
    }
    // Clear album highlight
    if (onHoverAlbum) {
      onHoverAlbum(null, null, 'timeline');
    }
  }, [onHover, onHoverAlbum]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={(e) => onClick(event, e)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`w-6 h-6 rounded-full ${colors.bg} ${colors.border} border-2 flex items-center justify-center
          hover:scale-125 transition-all duration-75 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500
          ${isHighlighted ? 'scale-150 ring-4 ring-yellow-400 ring-offset-2 z-50' : ''}`}
        title={`${event.title} (${event.year})`}
      >
        <span className="text-xs">{icon}</span>
      </button>

      {/* Always-visible diagonal album label - rendered via portal to escape overflow clipping */}
      {isAlbum && labelPos && (
        <TooltipPortal>
          <div
            className={`fixed z-[9998] pointer-events-none transition-all duration-150 ${isHighlighted ? 'scale-125' : ''}`}
            style={{
              left: labelPos.x,
              top: labelPos.y,
              transform: 'rotate(-45deg)',
              transformOrigin: 'bottom left',
            }}
          >
            <span className={`text-[10px] font-medium whitespace-nowrap transition-colors duration-150
              ${isHighlighted
                ? 'text-yellow-600 bg-yellow-100 px-1 py-0.5 rounded drop-shadow-lg'
                : 'text-purple-600 drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]'}`}>
              {event.title}
            </span>
          </div>
        </TooltipPortal>
      )}

      {/* Hover tooltip with more details - rendered via portal to escape overflow */}
      {isHovered && tooltipPos && (
        <TooltipPortal>
          <div
            className="fixed z-[9999] pointer-events-none"
            style={{
              left: tooltipPos.x,
              top: tooltipPos.y,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-xl whitespace-nowrap">
              <div className="font-semibold">{event.title}</div>
              {event.subtitle && <div className="text-gray-300 text-[11px] mt-0.5">{event.subtitle}</div>}
              <div className="text-gray-400 text-[11px] mt-0.5">{event.artistName} &bull; {event.year}</div>
            </div>
          </div>
        </TooltipPortal>
      )}
    </div>
  );
}

function LegendItem({ type }: { type: TimelineEventType }) {
  const colors = EVENT_COLORS[type];
  const icon = EVENT_ICONS[type];
  const labels: Record<TimelineEventType, string> = {
    album: 'Album',
    concert: 'Show',
    birth: 'Born',
    formation: 'Formed',
    disbanded: 'Ended',
    member_join: 'Joined',
    member_leave: 'Left',
    member_death: 'RIP',
  };

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs">{icon}</span>
      <span className={colors.text}>{labels[type]}</span>
    </div>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
