'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import type { WikidataArtistBio, WikidataPlace } from '@/lib/wikidata';

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

export type MapLocationType = 'birth' | 'death' | 'residence';

export interface MapLocation {
  type: MapLocationType;
  place: WikidataPlace;
  label: string;
}

interface ArtistMapProps {
  bio: WikidataArtistBio;
  className?: string;
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
function createMarkerIcon(color: string) {
  // We need to dynamically create an icon since Leaflet requires it
  // This returns a div icon with colored styling
  if (typeof window === 'undefined') return null;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const L = require('leaflet');

  return L.divIcon({
    className: 'custom-map-marker',
    html: `
      <div style="
        width: 24px;
        height: 24px;
        background-color: ${color};
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      "></div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
}

/**
 * Extract all map locations from artist bio
 */
function extractLocations(bio: WikidataArtistBio): MapLocation[] {
  const locations: MapLocation[] = [];

  if (bio.birthPlace?.coordinates) {
    locations.push({
      type: 'birth',
      place: bio.birthPlace,
      label: `Born: ${bio.birthPlace.name}${bio.birthDate ? ` (${bio.birthDate.split('-')[0]})` : ''}`,
    });
  }

  // Add residences
  bio.residences?.forEach((residence) => {
    if (residence.coordinates) {
      locations.push({
        type: 'residence',
        place: residence,
        label: `Lived in: ${residence.name}`,
      });
    }
  });

  if (bio.deathPlace?.coordinates) {
    locations.push({
      type: 'death',
      place: bio.deathPlace,
      label: `Died: ${bio.deathPlace.name}${bio.deathDate ? ` (${bio.deathDate.split('-')[0]})` : ''}`,
    });
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

function MapLegend() {
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
    </div>
  );
}

function MapContent({ locations }: { locations: MapLocation[] }) {
  const bounds = useMemo(() => calculateBounds(locations), [locations]);

  // Create polyline path through locations in order
  const pathCoordinates = useMemo(() => {
    return locations
      .filter((loc) => loc.place.coordinates)
      .map((loc) => [loc.place.coordinates!.latitude, loc.place.coordinates!.longitude] as [number, number]);
  }, [locations]);

  // Create marker icons for each type
  const icons = useMemo(() => {
    if (typeof window === 'undefined') return {};
    return {
      birth: createMarkerIcon(MARKER_COLORS.birth),
      death: createMarkerIcon(MARKER_COLORS.death),
      residence: createMarkerIcon(MARKER_COLORS.residence),
    };
  }, []);

  if (!bounds) return null;

  // Center on first location for initial view
  const center: [number, number] = [
    (bounds[0][0] + bounds[1][0]) / 2,
    (bounds[0][1] + bounds[1][1]) / 2,
  ];

  return (
    <MapContainer
      center={center}
      zoom={4}
      bounds={bounds}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Draw travel path */}
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
        const icon = icons[location.type];

        return (
          <Marker
            key={`${location.type}-${index}`}
            position={[location.place.coordinates.latitude, location.place.coordinates.longitude]}
            icon={icon}
          >
            <Popup>
              <div className="text-sm font-medium">{location.label}</div>
              {location.place.country && (
                <div className="text-xs text-gray-500">{location.place.country}</div>
              )}
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

export function ArtistMap({ bio, className = '' }: ArtistMapProps) {
  const locations = useMemo(() => extractLocations(bio), [bio]);

  // Don't render if no locations with coordinates
  if (locations.length === 0) {
    return (
      <div className="text-xs text-gray-400 py-2">
        No location data available
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={{ height: '200px' }}>
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
        crossOrigin=""
      />
      <MapContent locations={locations} />
      <MapLegend />
    </div>
  );
}
