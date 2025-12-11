import type { ArtistNode, ArtistRelationship, ArtistGraph } from '@/types';
import type { GroupedItem } from './types';
import { parseYear } from '@/lib/utils';

// Extract instruments from attributes (filter out non-instrument attributes)
export function extractInstruments(attributes?: string[]): string[] {
  if (!attributes) return [];

  const nonInstruments = ['founding', 'original', 'past', 'current', 'minor'];
  return attributes
    .filter(attr => !nonInstruments.some(ni => attr.toLowerCase().includes(ni)))
    .slice(0, 3); // Top 3 instruments
}

export function formatTenure(begin?: string, end?: string | null): string {
  const startYear = parseYear(begin);
  if (!startYear) return '';
  const endYear = parseYear(end);
  if (endYear) {
    return startYear === endYear ? String(startYear) : `${startYear}–${endYear}`;
  }
  return `${startYear}–present`;
}

export function isFoundingMember(
  rel: ArtistRelationship,
  earliestYear: number,
  supplementaryFounders?: Set<string>
): boolean {
  if (rel.type !== 'member_of') return false;

  // Check Wikipedia-derived supplementary data first (most reliable)
  if (supplementaryFounders) {
    if (supplementaryFounders.has(rel.target) || supplementaryFounders.has(rel.source)) {
      return true;
    }
  }

  // Check for explicit "founder" attribute in MusicBrainz
  const hasFoundingAttribute = rel.attributes?.some(
    attr => attr.toLowerCase().includes('found')
  );
  if (hasFoundingAttribute) return true;

  // Or if their start year exactly matches the earliest known member year
  const startYear = parseYear(rel.period?.begin);
  if (startYear && startYear === earliestYear) {
    return true;
  }

  return false;
}

export function getEarliestMemberYear(
  relationships: ArtistRelationship[],
  bandStartYear?: string
): number {
  let earliestYear = parseYear(bandStartYear) ?? 9999;

  for (const rel of relationships) {
    if (rel.type === 'member_of') {
      const year = parseYear(rel.period?.begin);
      if (year && year < earliestYear) earliestYear = year;
    }
  }

  return earliestYear;
}

export function groupRelationshipsByType(
  relationships: ArtistRelationship[],
  relatedArtists: ArtistNode[],
  bandStartYear?: string,
  supplementaryFounders?: Set<string>
): Map<string, GroupedItem[]> {
  const artistMap = new Map(relatedArtists.map(a => [a.id, a]));
  const grouped = new Map<string, GroupedItem[]>();
  const earliestYear = getEarliestMemberYear(relationships, bandStartYear);

  for (const rel of relationships) {
    const artist = artistMap.get(rel.target) || artistMap.get(rel.source);

    if (artist) {
      const type = rel.type;
      if (!grouped.has(type)) {
        grouped.set(type, []);
      }

      // Use relationship period if available, otherwise fall back to related artist's active years
      // This helps when MusicBrainz has dates on the band but not on the membership relationship
      const periodBegin = rel.period?.begin || artist.activeYears?.begin;
      // Use nullish coalescing - fall back to artist's activeYears if relationship period.end is null/undefined
      const periodEnd = rel.period?.end ?? artist.activeYears?.end;

      const startYear = parseYear(periodBegin) ?? 9999;
      const founding = isFoundingMember(rel, earliestYear, supplementaryFounders);
      const isCurrent = periodEnd === null || periodEnd === undefined;
      const tenure = formatTenure(periodBegin, periodEnd);

      grouped.get(type)!.push({
        relationship: rel,
        artist,
        isFoundingMember: founding,
        isCurrent,
        tenure,
        sortYear: startYear,
      });
    }
  }

  for (const [, items] of grouped) {
    items.sort((a, b) => {
      if (a.isFoundingMember && !b.isFoundingMember) return -1;
      if (!a.isFoundingMember && b.isFoundingMember) return 1;
      if (a.isCurrent && !b.isCurrent) return -1;
      if (!a.isCurrent && b.isCurrent) return 1;
      return a.sortYear - b.sortYear;
    });
  }

  return grouped;
}

// Build graph data with founding member status and instruments
export function buildGraphData(
  centerArtist: ArtistNode,
  relationships: ArtistRelationship[],
  relatedArtists: ArtistNode[],
  bandStartYear?: string,
  supplementaryFounders?: Set<string>
): ArtistGraph {
  const earliestYear = getEarliestMemberYear(relationships, bandStartYear);

  // Create maps for founding status and instruments per artist
  const foundingMap = new Map<string, boolean>();
  const instrumentsMap = new Map<string, string[]>();

  for (const rel of relationships) {
    const relatedId = rel.target !== centerArtist.id ? rel.target : rel.source;
    if (!foundingMap.has(relatedId)) {
      foundingMap.set(relatedId, isFoundingMember(rel, earliestYear, supplementaryFounders));
    }
    // Collect instruments from relationship attributes
    const instruments = extractInstruments(rel.attributes);
    if (instruments.length > 0) {
      const existing = instrumentsMap.get(relatedId) || [];
      instrumentsMap.set(relatedId, [...new Set([...existing, ...instruments])].slice(0, 3));
    }
  }

  // Create artist lookup for fallback period data
  const artistMap = new Map(relatedArtists.map(a => [a.id, a]));

  const nodes: ArtistGraph['nodes'] = [
    {
      data: {
        ...centerArtist,
        loaded: true,
      },
    },
    ...relatedArtists.map(a => ({
      data: {
        ...a,
        loaded: false,
        founding: foundingMap.get(a.id) || false,
        instruments: instrumentsMap.get(a.id),
      },
    })),
  ];

  // Enrich edges with fallback period from related artist's activeYears
  const edges: ArtistGraph['edges'] = relationships.map(rel => {
    const relatedId = rel.target !== centerArtist.id ? rel.target : rel.source;
    const relatedArtist = artistMap.get(relatedId);

    // Use relationship period if available, otherwise fall back to related artist's active years
    const periodBegin = rel.period?.begin || relatedArtist?.activeYears?.begin;
    // Use nullish coalescing - fall back to artist's activeYears if relationship period.end is null/undefined
    const periodEnd = rel.period?.end ?? relatedArtist?.activeYears?.end;

    return {
      data: {
        ...rel,
        period: {
          begin: periodBegin,
          end: periodEnd,
        },
      },
    };
  });

  return { nodes, edges };
}

// Merge new graph data into existing graph
export function mergeGraphData(
  existingGraph: ArtistGraph,
  newNodes: ArtistGraph['nodes'],
  newEdges: ArtistGraph['edges'],
  expandedNodeId: string
): ArtistGraph {
  const existingNodeIds = new Set(existingGraph.nodes.map(n => n.data.id));
  const existingEdgeIds = new Set(existingGraph.edges.map(e => e.data.id));

  const updatedNodes = existingGraph.nodes.map(n => {
    if (n.data.id === expandedNodeId) {
      return { ...n, data: { ...n.data, loaded: true } };
    }
    return n;
  });

  for (const node of newNodes) {
    if (!existingNodeIds.has(node.data.id)) {
      updatedNodes.push(node);
    }
  }

  const updatedEdges = [...existingGraph.edges];
  for (const edge of newEdges) {
    if (!existingEdgeIds.has(edge.data.id)) {
      updatedEdges.push(edge);
    }
  }

  return { nodes: updatedNodes, edges: updatedEdges };
}
