'use client';

import dynamic from 'next/dynamic';
import { useMemo, useEffect, useCallback, useState, useRef } from 'react';
import type { WikidataArtistBio, WikidataPlace } from '@/lib/wikidata';
import type { Marker as LeafletMarker } from 'leaflet';

// Dynamically import the map component to avoid SSR issues
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
);
const Polyline = dynamic(
  () => import('react-leaflet').then((mod) => mod.Polyline),
  { ssr: false }
);

// Component to fit map bounds after mount
const FitBounds = dynamic(
  () => import('react-leaflet').then((mod) => {
    const { useMap } = mod;
    // Create a component that fits bounds
    return function FitBoundsComponent({ bounds }: { bounds: [[number, number], [number, number]] }) {
      const map = useMap();
      useEffect(() => {
        if (bounds) {
          map.fitBounds(bounds, { padding: [20, 20] });
        }
      }, [map, bounds]);
      return null;
    };
  }),
  { ssr: false }
);

export type MapLocationType = 'birth' | 'death' | 'residence';

export interface MapLocation {
  type: MapLocationType;
  place: WikidataPlace;
  label: string;
  artistName?: string;  // For multi-artist maps
  birthDate?: string;   // For richer popup info
  deathDate?: string;
  wikipediaUrl?: string;
  description?: string;
}

interface BandInfo {
  name: string;
  formedYear?: string;
  albumCount?: number;
  memberCount?: number;
  wikipediaUrl?: string;
}

interface ArtistMapProps {
  bio?: WikidataArtistBio;         // Single artist bio
  bios?: WikidataArtistBio[];      // Multiple artist bios (for band view)
  className?: string;
  showTravelPath?: boolean;        // Whether to show travel path (default: true for single, false for multi)
  highlightedArtistName?: string | null;  // Artist name to highlight on map (for hover sync)
  onHoverArtist?: (artistName: string | null) => void;  // Callback when hovering over a marker
  bandInfo?: BandInfo;             // Band info for modal panel (multi-artist mode)
}

// Marker colors by type
const MARKER_COLORS: Record<MapLocationType, string> = {
  birth: '#22c55e',    // Green
  death: '#ef4444',    // Red
  residence: '#3b82f6', // Blue
};

/**
 * Create a colored marker icon for Leaflet
 */
function createMarkerIcon(color: string, highlighted: boolean = false) {
  if (typeof window === 'undefined') return null;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const L = require('leaflet');

  const size = highlighted ? 32 : 24;
  const borderWidth = highlighted ? 4 : 2;
  const borderColor = highlighted ? '#f97316' : 'white'; // Orange border when highlighted

  return L.divIcon({
    className: 'custom-map-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background-color: ${color};
        border: ${borderWidth}px solid ${borderColor};
        border-radius: 50%;
        box-shadow: ${highlighted ? '0 0 12px rgba(249, 115, 22, 0.6)' : '0 2px 4px rgba(0,0,0,0.3)'};
        transition: all 0.15s ease-out;
      "></div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

/**
 * Extract all map locations from a single artist bio
 */
function extractLocationsFromBio(bio: WikidataArtistBio, includeArtistName: boolean = false): MapLocation[] {
  const locations: MapLocation[] = [];
  const artistName = includeArtistName ? bio.name : undefined;
  // Common fields for all locations from this artist
  const commonFields = {
    artistName,
    birthDate: bio.birthDate,
    deathDate: bio.deathDate,
    wikipediaUrl: bio.wikipediaUrl,
    description: bio.description,
  };

  if (bio.birthPlace?.coordinates) {
    locations.push({
      type: 'birth',
      place: bio.birthPlace,
      label: `Born: ${bio.birthPlace.name}${bio.birthDate ? ` (${bio.birthDate.split('-')[0]})` : ''}`,
      ...commonFields,
    });
  }

  // Add residences
  bio.residences?.forEach((residence) => {
    if (residence.coordinates) {
      locations.push({
        type: 'residence',
        place: residence,
        label: `Lived in: ${residence.name}`,
        ...commonFields,
      });
    }
  });

  if (bio.deathPlace?.coordinates) {
    locations.push({
      type: 'death',
      place: bio.deathPlace,
      label: `Died: ${bio.deathPlace.name}${bio.deathDate ? ` (${bio.deathDate.split('-')[0]})` : ''}`,
      ...commonFields,
    });
  }

  return locations;
}

/**
 * Extract locations from multiple artist bios
 */
function extractLocationsFromBios(bios: WikidataArtistBio[]): MapLocation[] {
  const locations: MapLocation[] = [];

  for (const bio of bios) {
    locations.push(...extractLocationsFromBio(bio, true));
  }

  return locations;
}

/**
 * Calculate bounds to fit all locations
 */
function calculateBounds(locations: MapLocation[]): [[number, number], [number, number]] | null {
  if (locations.length === 0) return null;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  locations.forEach(({ place }) => {
    if (place.coordinates) {
      minLat = Math.min(minLat, place.coordinates.latitude);
      maxLat = Math.max(maxLat, place.coordinates.latitude);
      minLng = Math.min(minLng, place.coordinates.longitude);
      maxLng = Math.max(maxLng, place.coordinates.longitude);
    }
  });

  // Add padding
  const latPadding = (maxLat - minLat) * 0.2 || 1;
  const lngPadding = (maxLng - minLng) * 0.2 || 1;

  return [
    [minLat - latPadding, minLng - lngPadding],
    [maxLat + latPadding, maxLng + lngPadding],
  ];
}

function MapLegend({ isMultiArtist }: { isMultiArtist: boolean }) {
  return (
    <div className="absolute bottom-2 left-2 z-[1000] bg-white/90 rounded px-2 py-1.5 text-xs shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: MARKER_COLORS.birth }} />
          <span>Birth</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: MARKER_COLORS.residence }} />
          <span>Residence</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: MARKER_COLORS.death }} />
          <span>Death</span>
        </div>
      </div>
      {isMultiArtist && (
        <div className="text-gray-500 mt-1 text-center">
          All band members
        </div>
      )}
    </div>
  );
}

interface MapContentProps {
  locations: MapLocation[];
  showTravelPath: boolean;
  enableScrollZoom?: boolean;
  highlightedArtistName?: string | null;
  onHoverArtist?: (artistName: string | null) => void;
  isModal?: boolean;  // Enhanced popup behavior for modal view
}

/**
 * Calculate age from birth/death dates
 */
function calculateAge(birthDate?: string, deathDate?: string): string | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const end = deathDate ? new Date(deathDate) : new Date();
  const age = Math.floor((end.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return age > 0 ? `${age}` : null;
}

/**
 * Format date for display
 */
function formatDate(dateStr?: string): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function MapContent({ locations, showTravelPath, enableScrollZoom = false, highlightedArtistName, onHoverArtist, isModal = false }: MapContentProps) {
  const bounds = useMemo(() => calculateBounds(locations), [locations]);
  const markerRefs = useRef<Map<string, LeafletMarker>>(new Map());
  const closeTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const isMouseInPopupRef = useRef<Set<string>>(new Set());

  // Create polyline path through locations in order (only for single artist)
  const pathCoordinates = useMemo(() => {
    if (!showTravelPath) return [];
    return locations
      .filter((loc) => loc.place.coordinates)
      .map((loc) => [loc.place.coordinates!.latitude, loc.place.coordinates!.longitude] as [number, number]);
  }, [locations, showTravelPath]);

  // Create marker icons for each type and highlight state
  // We need to create icons dynamically based on highlight state
  const getIcon = useCallback((type: MapLocationType, artistName?: string) => {
    if (typeof window === 'undefined') return null;
    const isHighlighted = !!(highlightedArtistName && artistName && artistName === highlightedArtistName);
    return createMarkerIcon(MARKER_COLORS[type], isHighlighted);
  }, [highlightedArtistName]);

  if (!bounds) return null;

  // Center on first location for initial view
  const center: [number, number] = [
    (bounds[0][0] + bounds[1][0]) / 2,
    (bounds[0][1] + bounds[1][1]) / 2,
  ];

  return (
    <MapContainer
      center={center}
      zoom={2}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom={enableScrollZoom}
    >
      {/* Fit bounds after map mounts */}
      <FitBounds bounds={bounds} />

      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Draw travel path (single artist only) */}
      {pathCoordinates.length > 1 && (
        <Polyline
          positions={pathCoordinates}
          color="#6b7280"
          weight={2}
          opacity={0.6}
          dashArray="5, 5"
        />
      )}

      {/* Render markers */}
      {locations.map((location, index) => {
        if (!location.place.coordinates) return null;
        const icon = getIcon(location.type, location.artistName);
        const markerId = `${location.artistName || 'artist'}-${location.type}-${index}`;
        const age = calculateAge(location.birthDate, location.deathDate);

        return (
          <Marker
            key={`${markerId}-${highlightedArtistName === location.artistName ? 'hl' : ''}`}
            position={[location.place.coordinates.latitude, location.place.coordinates.longitude]}
            icon={icon}
            ref={(ref) => {
              if (ref) markerRefs.current.set(markerId, ref);
            }}
            eventHandlers={{
              mouseover: (e) => {
                if (onHoverArtist && location.artistName) {
                  onHoverArtist(location.artistName);
                }
                // Auto-open popup on hover in modal mode
                if (isModal) {
                  // Clear any pending close timeout
                  const existingTimeout = closeTimeoutRef.current.get(markerId);
                  if (existingTimeout) {
                    clearTimeout(existingTimeout);
                    closeTimeoutRef.current.delete(markerId);
                  }
                  e.target.openPopup();
                }
              },
              mouseout: (e) => {
                if (onHoverArtist) {
                  onHoverArtist(null);
                }
                // Delayed close popup on mouse out in modal mode
                // This gives user time to move mouse into the popup
                if (isModal) {
                  const timeout = setTimeout(() => {
                    // Only close if mouse is not in the popup
                    if (!isMouseInPopupRef.current.has(markerId)) {
                      e.target.closePopup();
                    }
                    closeTimeoutRef.current.delete(markerId);
                  }, 300); // 300ms delay to allow moving to popup
                  closeTimeoutRef.current.set(markerId, timeout);
                }
              },
            }}
          >
            <Popup
              eventHandlers={isModal ? {
                add: (e) => {
                  // Add mouse event listeners to the popup container
                  const popupEl = e.target.getElement();
                  if (popupEl) {
                    popupEl.addEventListener('mouseenter', () => {
                      isMouseInPopupRef.current.add(markerId);
                      // Clear any pending close timeout
                      const existingTimeout = closeTimeoutRef.current.get(markerId);
                      if (existingTimeout) {
                        clearTimeout(existingTimeout);
                        closeTimeoutRef.current.delete(markerId);
                      }
                    });
                    popupEl.addEventListener('mouseleave', () => {
                      isMouseInPopupRef.current.delete(markerId);
                      // Get the marker and close its popup after a delay
                      const marker = markerRefs.current.get(markerId);
                      if (marker) {
                        const timeout = setTimeout(() => {
                          marker.closePopup();
                          closeTimeoutRef.current.delete(markerId);
                        }, 200);
                        closeTimeoutRef.current.set(markerId, timeout);
                      }
                    });
                  }
                },
              } : undefined}
            >
              {/* Artist name */}
              {location.artistName && (
                <div className="text-base font-bold text-blue-600 mb-1">{location.artistName}</div>
              )}

              {/* Location info */}
              <div className="text-sm font-medium">{location.label}</div>
              {location.place.country && (
                <div className="text-xs text-gray-500 mb-2">{location.place.country}</div>
              )}

              {/* Enhanced info for modal view */}
              {isModal && (
                <div className="border-t pt-2 mt-2 space-y-1">
                  {/* Birth/Death dates */}
                  {location.birthDate && (
                    <div className="text-xs text-gray-600">
                      <span className="font-medium">Born:</span> {formatDate(location.birthDate)}
                    </div>
                  )}
                  {location.deathDate && (
                    <div className="text-xs text-gray-600">
                      <span className="font-medium">Died:</span> {formatDate(location.deathDate)}
                      {age && ` (age ${age})`}
                    </div>
                  )}
                  {!location.deathDate && age && (
                    <div className="text-xs text-gray-600">
                      <span className="font-medium">Age:</span> {age}
                    </div>
                  )}

                  {/* Description */}
                  {location.description && (
                    <div className="text-xs text-gray-500 italic mt-1">{location.description}</div>
                  )}

                  {/* Wikipedia link */}
                  {location.wikipediaUrl && (
                    <a
                      href={location.wikipediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:text-blue-700 hover:underline block mt-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View on Wikipedia →
                    </a>
                  )}
                </div>
              )}
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

export function ArtistMap({ bio, bios, className = '', showTravelPath, highlightedArtistName, onHoverArtist, bandInfo }: ArtistMapProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Determine if this is multi-artist mode
  const isMultiArtist = !!bios && bios.length > 0;

  // Extract locations from bio(s)
  const locations = useMemo(() => {
    if (bios && bios.length > 0) {
      return extractLocationsFromBios(bios);
    }
    if (bio) {
      return extractLocationsFromBio(bio, false);
    }
    return [];
  }, [bio, bios]);

  // Default showTravelPath: true for single artist, false for multi
  const shouldShowPath = showTravelPath ?? !isMultiArtist;

  // Generate a stable key for the map based on location data
  // This helps React properly handle map remounting during drag-and-drop
  const mapKey = useMemo(() => {
    const locationIds = locations
      .map(l => `${l.artistName || ''}-${l.type}-${l.place.id}`)
      .sort()
      .join('|');
    return `map-${locationIds}`;
  }, [locations]);

  // Handle double-click to open modal
  const handleDoubleClick = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  // Handle closing modal
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  // Handle keyboard events for modal (Escape to close)
  useEffect(() => {
    if (!isModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsModalOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isModalOpen]);

  // Don't render if no locations with coordinates
  if (locations.length === 0) {
    return (
      <div className="text-xs text-gray-400 py-2">
        No location data available
      </div>
    );
  }

  return (
    <>
      {/* Inline map in sidebar */}
      <div
        className={`relative ${className} cursor-pointer`}
        style={{ height: '200px' }}
        key={mapKey}
        onDoubleClick={handleDoubleClick}
        title="Double-click to expand"
      >
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
        <MapContent locations={locations} showTravelPath={shouldShowPath} highlightedArtistName={highlightedArtistName} onHoverArtist={onHoverArtist} />
        <MapLegend isMultiArtist={isMultiArtist} />
        {/* Hint for double-click */}
        <div className="absolute top-1 right-1 z-[1000] bg-white/80 rounded px-1.5 py-0.5 text-[10px] text-gray-500 pointer-events-none">
          Double-click to expand
        </div>
      </div>

      {/* Fullscreen modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4"
          onClick={handleCloseModal}
        >
          <div
            className="relative bg-white rounded-lg w-full h-full max-w-[95vw] max-h-[90vh] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={handleCloseModal}
              className="absolute top-3 right-3 z-[10001] bg-white hover:bg-gray-100 rounded-full p-2 shadow-lg transition-colors"
              title="Close (Escape)"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Title */}
            <div className="absolute top-3 left-3 z-[10001] bg-white/90 rounded px-3 py-1.5 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-800">
                {isMultiArtist ? 'Band Member Origins' : 'Artist Geography'}
              </h3>
              <p className="text-xs text-gray-500">
                {locations.length} location{locations.length !== 1 ? 's' : ''} • Scroll to zoom
              </p>
            </div>

            {/* Map content - full size with scroll zoom enabled */}
            <div className="w-full h-full">
              <MapContent
                key={`modal-${mapKey}`}
                locations={locations}
                showTravelPath={shouldShowPath}
                enableScrollZoom={true}
                isModal={true}
              />
            </div>

            {/* Legend in modal */}
            <MapLegend isMultiArtist={isMultiArtist} />

            {/* Band info panel (bottom right) */}
            {isMultiArtist && bandInfo && (
              <div className="absolute bottom-3 right-3 z-[10001] bg-white/95 rounded-lg px-4 py-3 shadow-lg max-w-xs">
                <h4 className="font-bold text-gray-800 mb-2">{bandInfo.name}</h4>
                <div className="space-y-1 text-sm text-gray-600">
                  {bandInfo.formedYear && (
                    <div>
                      <span className="font-medium">Formed:</span> {bandInfo.formedYear}
                    </div>
                  )}
                  {bandInfo.memberCount && (
                    <div>
                      <span className="font-medium">Members shown:</span> {bandInfo.memberCount}
                    </div>
                  )}
                  {bandInfo.albumCount && (
                    <div>
                      <span className="font-medium">Albums:</span> {bandInfo.albumCount}
                    </div>
                  )}
                </div>
                {bandInfo.wikipediaUrl && (
                  <a
                    href={bandInfo.wikipediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:text-blue-700 hover:underline block mt-2"
                  >
                    View band on Wikipedia →
                  </a>
                )}

                {/* Member list */}
                {bios && bios.length > 0 && (
                  <div className="mt-3 pt-2 border-t">
                    <div className="text-xs font-medium text-gray-500 mb-1">Band Members:</div>
                    <div className="space-y-0.5">
                      {bios.map((memberBio) => (
                        <div key={memberBio.wikidataId} className="text-xs text-gray-600 flex items-center gap-1">
                          <span>{memberBio.name}</span>
                          {memberBio.birthDate && (
                            <span className="text-gray-400">
                              ({memberBio.birthDate.split('-')[0]}–{memberBio.deathDate ? memberBio.deathDate.split('-')[0] : 'present'})
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
