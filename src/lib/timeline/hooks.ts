'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { getArtistReleaseGroups, getArtistLifeSpan } from '@/lib/musicbrainz';
import { getArtistEvents } from '@/lib/concerts';
import type {
  TimelineEvent,
  TimelineEventType,
  ArtistNode,
  ArtistRelationship,
  MusicBrainzReleaseGroup,
} from '@/types';

interface UseArtistTimelineParams {
  artist: ArtistNode | null;
  relationships?: ArtistRelationship[];
  relatedArtists?: Map<string, ArtistNode>;
}

/**
 * Fetch life-span data for person members (to detect deaths)
 * This is separate from the main relationships query due to MusicBrainz rate limiting
 */
async function fetchMemberDeaths(
  relationships: ArtistRelationship[],
  relatedArtists: Map<string, ArtistNode>
): Promise<Map<string, { begin?: string; end?: string | null }>> {
  const deaths = new Map<string, { begin?: string; end?: string | null }>();

  // Find person-type members who might have death dates
  const personMembers: string[] = [];
  for (const rel of relationships) {
    if (rel.type === 'member_of') {
      const artistId = rel.source !== rel.target ? rel.target : rel.source;
      const artist = relatedArtists.get(artistId);
      // Only fetch for persons who don't already have activeYears
      if (artist && artist.type === 'person' && !artist.activeYears?.end) {
        personMembers.push(artistId);
      }
    }
  }

  // Fetch life-span for each person member (respects rate limit via the client queue)
  for (const mbid of personMembers) {
    const lifeSpan = await getArtistLifeSpan(mbid);
    if (lifeSpan?.end) {
      deaths.set(mbid, lifeSpan);
    }
  }

  return deaths;
}

interface UseArtistTimelineResult {
  events: TimelineEvent[];
  isLoading: boolean;
  error: Error | null;
  yearRange: { min: number; max: number } | null;
}

/**
 * Parse a partial date string (YYYY, YYYY-MM, or YYYY-MM-DD) into a Date object
 */
function parseMusicBrainzDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;

  // Handle year-only (YYYY)
  if (dateStr.length === 4) {
    return new Date(parseInt(dateStr), 0, 1);
  }

  // Handle year-month (YYYY-MM)
  if (dateStr.length === 7) {
    const [year, month] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, 1);
  }

  // Handle full date (YYYY-MM-DD)
  if (dateStr.length === 10) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  return null;
}

/**
 * Convert release groups to timeline events
 */
function releaseGroupsToEvents(
  releaseGroups: MusicBrainzReleaseGroup[],
  artistName: string
): TimelineEvent[] {
  return releaseGroups
    .filter((rg) => rg['first-release-date'])
    .map((rg): TimelineEvent => {
      const date = parseMusicBrainzDate(rg['first-release-date']);
      if (!date) {
        // Fallback - shouldn't happen due to filter
        return null as unknown as TimelineEvent;
      }

      return {
        id: `album-${rg.id}`,
        date,
        year: date.getFullYear(),
        type: 'album' as TimelineEventType,
        title: rg.title,
        subtitle: rg['primary-type'] || 'Album',
        externalUrl: `https://musicbrainz.org/release-group/${rg.id}`,
        artistName,
      };
    })
    .filter(Boolean);
}

/**
 * Extract formation/birth/dissolution events from artist node
 * For persons: activeYears.begin = birth date, activeYears.end = death date
 * For groups: activeYears.begin = formation date, activeYears.end = disbanded date
 */
function getLifecycleEvents(artist: ArtistNode, firstAlbumYear?: number): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const isPerson = artist.type === 'person';

  if (artist.activeYears?.begin) {
    const date = parseMusicBrainzDate(artist.activeYears.begin);
    if (date) {
      if (isPerson) {
        // For persons, this is their birth date
        events.push({
          id: `birth-${artist.id}`,
          date,
          year: date.getFullYear(),
          type: 'birth',
          title: `${artist.name} Born`,
          subtitle: artist.country || undefined,
          externalUrl: `https://musicbrainz.org/artist/${artist.id}`,
          artistName: artist.name,
        });
      } else {
        // For groups, this is their formation date
        events.push({
          id: `formation-${artist.id}`,
          date,
          year: date.getFullYear(),
          type: 'formation',
          title: `${artist.name} Formed`,
          subtitle: artist.country || undefined,
          externalUrl: `https://musicbrainz.org/artist/${artist.id}`,
          artistName: artist.name,
        });
      }
    }
  }

  // For persons, add a "career began" event based on first album release
  if (isPerson && firstAlbumYear) {
    const careerDate = new Date(firstAlbumYear, 0, 1);
    events.push({
      id: `career-${artist.id}`,
      date: careerDate,
      year: firstAlbumYear,
      type: 'formation',
      title: `${artist.name} Career Began`,
      externalUrl: `https://musicbrainz.org/artist/${artist.id}`,
      artistName: artist.name,
    });
  }

  if (artist.activeYears?.end) {
    const date = parseMusicBrainzDate(artist.activeYears.end);
    if (date) {
      // For persons, activeYears.end means death; for groups, it means disbanded
      events.push({
        id: isPerson ? `death-${artist.id}` : `disbanded-${artist.id}`,
        date,
        year: date.getFullYear(),
        type: isPerson ? 'member_death' : 'disbanded',
        title: isPerson ? `${artist.name} Passed Away` : `${artist.name} Disbanded`,
        externalUrl: `https://musicbrainz.org/artist/${artist.id}`,
        artistName: artist.name,
      });
    }
  }

  return events;
}

/**
 * Extract member join/leave/death events from relationships
 */
function getMemberEvents(
  relationships: ArtistRelationship[],
  relatedArtists: Map<string, ArtistNode>,
  centralArtist: ArtistNode,
  memberDeaths?: Map<string, { begin?: string; end?: string | null }>
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const processedDeaths = new Set<string>(); // Track deaths to avoid duplicates

  for (const rel of relationships) {
    if (rel.type !== 'member_of') continue;

    const relatedArtist = relatedArtists.get(rel.source === centralArtist.id ? rel.target : rel.source);
    if (!relatedArtist) continue;

    // Member joined
    if (rel.period?.begin) {
      const date = parseMusicBrainzDate(rel.period.begin);
      if (date) {
        events.push({
          id: `member-join-${rel.id}`,
          date,
          year: date.getFullYear(),
          type: 'member_join',
          title: `${relatedArtist.name} Joined`,
          subtitle: centralArtist.type === 'group' ? centralArtist.name : undefined,
          externalUrl: `https://musicbrainz.org/artist/${relatedArtist.id}`,
          relatedArtistIds: [relatedArtist.id],
          artistName: centralArtist.name,
        });
      }
    }

    // Member left
    if (rel.period?.end) {
      const date = parseMusicBrainzDate(rel.period.end);
      if (date) {
        events.push({
          id: `member-leave-${rel.id}`,
          date,
          year: date.getFullYear(),
          type: 'member_leave',
          title: `${relatedArtist.name} Left`,
          subtitle: centralArtist.type === 'group' ? centralArtist.name : undefined,
          externalUrl: `https://musicbrainz.org/artist/${relatedArtist.id}`,
          relatedArtistIds: [relatedArtist.id],
          artistName: centralArtist.name,
        });
      }
    }

    // Member death - check from fetched death data first, then fallback to activeYears
    const deathData = memberDeaths?.get(relatedArtist.id);
    const deathDateStr = deathData?.end || (relatedArtist.type === 'person' ? relatedArtist.activeYears?.end : null);

    if (deathDateStr && !processedDeaths.has(relatedArtist.id)) {
      const deathDate = parseMusicBrainzDate(deathDateStr);
      if (deathDate) {
        processedDeaths.add(relatedArtist.id);
        events.push({
          id: `member-death-${relatedArtist.id}`,
          date: deathDate,
          year: deathDate.getFullYear(),
          type: 'member_death',
          title: `${relatedArtist.name} Passed Away`,
          externalUrl: `https://musicbrainz.org/artist/${relatedArtist.id}`,
          relatedArtistIds: [relatedArtist.id],
          artistName: centralArtist.name,
        });
      }
    }
  }

  return events;
}

/**
 * Hook to build a complete timeline for an artist
 */
export function useArtistTimeline({
  artist,
  relationships = [],
  relatedArtists = new Map(),
}: UseArtistTimelineParams): UseArtistTimelineResult {
  // Fetch release groups (albums)
  const {
    data: releaseGroups,
    isLoading: isLoadingReleases,
    error: releasesError,
  } = useQuery({
    queryKey: ['artistReleaseGroups', artist?.id],
    queryFn: () => getArtistReleaseGroups(artist!.id),
    enabled: !!artist?.id,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });

  // Fetch concerts
  const {
    data: concerts,
    isLoading: isLoadingConcerts,
    error: concertsError,
  } = useQuery({
    queryKey: ['artistConcerts', artist?.name],
    queryFn: () => getArtistEvents(artist!.name),
    enabled: !!artist?.name,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });

  // Fetch death dates for person members (separate API calls due to MusicBrainz data structure)
  const {
    data: memberDeaths,
    isLoading: isLoadingDeaths,
  } = useQuery({
    queryKey: ['memberDeaths', artist?.id, relationships.map(r => r.id).join(',')],
    queryFn: () => fetchMemberDeaths(relationships, relatedArtists),
    enabled: !!artist?.id && relationships.length > 0,
    staleTime: 60 * 60 * 1000, // 1 hour (death dates don't change)
  });

  // Build combined timeline
  const events = useMemo(() => {
    if (!artist) return [];

    const allEvents: TimelineEvent[] = [];

    // Add album events
    if (releaseGroups) {
      allEvents.push(...releaseGroupsToEvents(releaseGroups, artist.name));
    }

    // Add concert events
    if (concerts) {
      const concertEvents: TimelineEvent[] = concerts.map((concert) => ({
        id: `concert-${concert.id}`,
        date: concert.date,
        year: concert.date.getFullYear(),
        type: 'concert' as TimelineEventType,
        title: concert.venue,
        subtitle: `${concert.city}${concert.region ? `, ${concert.region}` : ''}`,
        externalUrl: concert.ticketUrl || undefined,
        artistName: artist.name,
      }));
      allEvents.push(...concertEvents);
    }

    // Find first album year for persons (to mark career start)
    let firstAlbumYear: number | undefined;
    if (artist.type === 'person' && releaseGroups && releaseGroups.length > 0) {
      const albumYears = releaseGroups
        .map(rg => parseMusicBrainzDate(rg['first-release-date']))
        .filter((d): d is Date => d !== null)
        .map(d => d.getFullYear());
      if (albumYears.length > 0) {
        firstAlbumYear = Math.min(...albumYears);
      }
    }

    // Add lifecycle events (birth/formation/death/disbanded)
    allEvents.push(...getLifecycleEvents(artist, firstAlbumYear));

    // Add member events (including deaths from separately fetched data)
    allEvents.push(...getMemberEvents(relationships, relatedArtists, artist, memberDeaths));

    // Sort by date (oldest first)
    return allEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [artist, releaseGroups, concerts, relationships, relatedArtists, memberDeaths]);

  // Calculate year range
  const yearRange = useMemo(() => {
    if (events.length === 0) return null;

    const years = events.map((e) => e.year);
    return {
      min: Math.min(...years),
      max: Math.max(...years),
    };
  }, [events]);

  const isLoading = isLoadingReleases || isLoadingConcerts || isLoadingDeaths;
  const error = releasesError || concertsError || null;

  return {
    events,
    isLoading,
    error,
    yearRange,
  };
}
