'use client';

import { useEffect, useRef } from 'react';
import type { TimelineEvent, TimelineEventType } from '@/types';

interface TimelineEventPopupProps {
  event: TimelineEvent;
  position: { x: number; y: number };
  onClose: () => void;
}

const EVENT_LABELS: Record<TimelineEventType, string> = {
  album: 'Album Release',
  concert: 'Concert',
  birth: 'Born',
  formation: 'Formation',
  disbanded: 'Disbanded',
  member_join: 'Member Joined',
  member_leave: 'Member Left',
  member_death: 'Passed Away',
};

const EVENT_COLORS: Record<TimelineEventType, string> = {
  album: 'text-purple-600',
  concert: 'text-blue-600',
  birth: 'text-pink-600',
  formation: 'text-green-600',
  disbanded: 'text-red-600',
  member_join: 'text-emerald-600',
  member_leave: 'text-orange-600',
  member_death: 'text-gray-600',
};

export function TimelineEventPopup({ event, position, onClose }: TimelineEventPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    }

    // Close on escape key
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Format date for display
  const formattedDate = event.date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Position the popup above the clicked element
  const style = {
    left: `${position.x}px`,
    bottom: `calc(100vh - ${position.y}px + 8px)`,
  };

  return (
    <div
      ref={popupRef}
      className="fixed z-50 transform -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 duration-200"
      style={style}
    >
      <div className="bg-white rounded-lg shadow-xl border border-gray-200 min-w-[280px] max-w-[350px] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium uppercase tracking-wide ${EVENT_COLORS[event.type]}`}>
              {EVENT_LABELS[event.type]}
            </span>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-3">
          <h3 className="font-semibold text-gray-900 text-base leading-tight">
            {event.title}
          </h3>

          {event.subtitle && (
            <p className="text-sm text-gray-600 mt-1">{event.subtitle}</p>
          )}

          <p className="text-xs text-gray-500 mt-2">{formattedDate}</p>

          {event.artistName && (
            <p className="text-xs text-gray-400 mt-1">
              Artist: {event.artistName}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex gap-2">
          {event.externalUrl && (
            <a
              href={event.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
            >
              View Details
              <ExternalLinkIcon className="w-3 h-3 inline-block ml-1" />
            </a>
          )}
          {event.relatedArtistIds && event.relatedArtistIds.length > 0 && (
            <button
              onClick={() => {
                // This will be handled by the parent component
              }}
              className="flex-1 text-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
            >
              Highlight in Graph
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
      />
    </svg>
  );
}
