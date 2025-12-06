/**
 * Wikidata API client for fetching artist biographical data
 *
 * Wikidata provides structured data about artists including:
 * - Birth/death dates and locations (with coordinates)
 * - Family relationships (spouses, children)
 * - Wikipedia links
 * - Images
 */

import { cacheGet, cacheSet, CacheTTL } from '@/lib/cache';
import type {
  WikidataArtistBio,
  WikidataPlace,
  WikidataPerson,
  WikidataCoordinates,
} from './types';
import { WIKIDATA_PROPERTIES as P } from './types';

const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const WIKIDATA_ENTITY_API = 'https://www.wikidata.org/wiki/Special:EntityData';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WikidataEntity = any; // Wikidata's structure is complex and varies

/**
 * Fetch a Wikidata entity by its Q-ID
 */
async function fetchEntity(qid: string): Promise<WikidataEntity | null> {
  const cacheKey = `wikidata-entity-${qid}`;
  const cached = cacheGet<WikidataEntity>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`${WIKIDATA_ENTITY_API}/${qid}.json`);
    if (!response.ok) return null;

    const data = await response.json();
    const entity = data.entities?.[qid];

    if (entity) {
      cacheSet(cacheKey, entity, CacheTTL.LONG);
    }

    return entity || null;
  } catch (error) {
    console.error(`Failed to fetch Wikidata entity ${qid}:`, error);
    return null;
  }
}

/**
 * Look up Wikidata Q-ID by MusicBrainz artist MBID
 */
export async function getWikidataIdByMbid(mbid: string): Promise<string | null> {
  const cacheKey = `wikidata-mbid-${mbid}`;
  const cached = cacheGet<string>(cacheKey);
  if (cached) return cached;

  try {
    // Use SPARQL endpoint to find Wikidata ID by MusicBrainz ID
    const sparqlQuery = `
      SELECT ?item WHERE {
        ?item wdt:${P.MUSICBRAINZ_ARTIST_ID} "${mbid}".
      }
      LIMIT 1
    `;

    const response = await fetch(
      `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparqlQuery)}&format=json`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'InterChord/1.0 (https://interchord.stonefrog.com)',
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const results = data.results?.bindings;

    if (results && results.length > 0) {
      // Extract Q-ID from URI like "http://www.wikidata.org/entity/Q42775"
      const uri = results[0].item?.value;
      const qid = uri?.split('/').pop();

      if (qid) {
        cacheSet(cacheKey, qid, CacheTTL.LONG);
        return qid;
      }
    }

    return null;
  } catch (error) {
    console.error(`Failed to look up Wikidata ID for MBID ${mbid}:`, error);
    return null;
  }
}

/**
 * Extract a simple value from Wikidata claims
 */
function getClaimValue(entity: WikidataEntity, property: string): string | undefined {
  const claims = entity.claims?.[property];
  if (!claims || claims.length === 0) return undefined;

  const value = claims[0].mainsnak?.datavalue?.value;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value.time) {
    // Parse Wikidata time format: "+1932-02-26T00:00:00Z"
    return value.time.replace(/^\+/, '').split('T')[0];
  }
  return undefined;
}

/**
 * Extract coordinates from Wikidata claims
 */
function getCoordinates(entity: WikidataEntity, property: string): WikidataCoordinates | undefined {
  const claims = entity.claims?.[property];
  if (!claims || claims.length === 0) return undefined;

  const value = claims[0].mainsnak?.datavalue?.value;
  if (value && typeof value.latitude === 'number' && typeof value.longitude === 'number') {
    return {
      latitude: value.latitude,
      longitude: value.longitude,
    };
  }
  return undefined;
}

/**
 * Extract entity reference (Q-ID) from Wikidata claims
 */
function getEntityReference(entity: WikidataEntity, property: string): string | undefined {
  const claims = entity.claims?.[property];
  if (!claims || claims.length === 0) return undefined;

  const value = claims[0].mainsnak?.datavalue?.value;
  if (value && value.id) return value.id;
  return undefined;
}

/**
 * Get all entity references for a property (e.g., multiple spouses)
 */
function getAllEntityReferences(entity: WikidataEntity, property: string): string[] {
  const claims = entity.claims?.[property];
  if (!claims) return [];

  return claims
    .map((claim: WikidataEntity) => claim.mainsnak?.datavalue?.value?.id)
    .filter(Boolean);
}

/**
 * Get label (name) for an entity in English
 */
function getLabel(entity: WikidataEntity): string {
  return entity.labels?.en?.value || entity.labels?.['en-gb']?.value || 'Unknown';
}

/**
 * Get description for an entity in English
 */
function getDescription(entity: WikidataEntity): string | undefined {
  return entity.descriptions?.en?.value || entity.descriptions?.['en-gb']?.value;
}

/**
 * Get Wikipedia URL from sitelinks
 */
function getWikipediaUrl(entity: WikidataEntity): string | undefined {
  const enwiki = entity.sitelinks?.enwiki;
  if (enwiki?.title) {
    return `https://en.wikipedia.org/wiki/${encodeURIComponent(enwiki.title)}`;
  }
  return undefined;
}

/**
 * Get Wikimedia Commons image URL
 */
function getImageUrl(entity: WikidataEntity): string | undefined {
  const imageName = getClaimValue(entity, P.IMAGE);
  if (!imageName) return undefined;

  // Convert filename to Wikimedia Commons URL
  const encodedName = encodeURIComponent(imageName.replace(/ /g, '_'));
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodedName}?width=300`;
}

/**
 * Fetch place details including coordinates
 */
async function fetchPlace(qid: string): Promise<WikidataPlace | null> {
  const entity = await fetchEntity(qid);
  if (!entity) return null;

  const countryQid = getEntityReference(entity, P.COUNTRY);
  let countryName: string | undefined;
  if (countryQid) {
    const countryEntity = await fetchEntity(countryQid);
    if (countryEntity) {
      countryName = getLabel(countryEntity);
    }
  }

  return {
    id: qid,
    name: getLabel(entity),
    coordinates: getCoordinates(entity, P.COORDINATES),
    country: countryName,
  };
}

/**
 * Fetch person details (for spouse/child)
 */
async function fetchPerson(qid: string): Promise<WikidataPerson | null> {
  const entity = await fetchEntity(qid);
  if (!entity) return null;

  return {
    id: qid,
    name: getLabel(entity),
  };
}

/**
 * Get full artist biographical data from Wikidata
 */
export async function getArtistBio(wikidataId: string): Promise<WikidataArtistBio | null> {
  const cacheKey = `wikidata-bio-${wikidataId}`;
  const cached = cacheGet<WikidataArtistBio>(cacheKey);
  if (cached) return cached;

  const entity = await fetchEntity(wikidataId);
  if (!entity) return null;

  // Fetch places in parallel
  const birthPlaceQid = getEntityReference(entity, P.PLACE_OF_BIRTH);
  const deathPlaceQid = getEntityReference(entity, P.PLACE_OF_DEATH);
  const residenceQids = getAllEntityReferences(entity, P.RESIDENCE).slice(0, 10);

  const [birthPlace, deathPlace, ...residences] = await Promise.all([
    birthPlaceQid ? fetchPlace(birthPlaceQid) : null,
    deathPlaceQid ? fetchPlace(deathPlaceQid) : null,
    ...residenceQids.map(fetchPlace),
  ]);

  // Fetch family members (limit to first 5 each to avoid too many requests)
  const spouseQids = getAllEntityReferences(entity, P.SPOUSE).slice(0, 5);
  const childQids = getAllEntityReferences(entity, P.CHILD).slice(0, 10);

  const [spouses, children] = await Promise.all([
    Promise.all(spouseQids.map(fetchPerson)),
    Promise.all(childQids.map(fetchPerson)),
  ]);

  const bio: WikidataArtistBio = {
    wikidataId,
    name: getLabel(entity),
    description: getDescription(entity),
    birthDate: getClaimValue(entity, P.DATE_OF_BIRTH),
    birthPlace: birthPlace || undefined,
    deathDate: getClaimValue(entity, P.DATE_OF_DEATH),
    deathPlace: deathPlace || undefined,
    residences: residences.filter((r): r is WikidataPlace => r !== null),
    spouses: spouses.filter((s): s is WikidataPerson => s !== null),
    children: children.filter((c): c is WikidataPerson => c !== null),
    wikipediaUrl: getWikipediaUrl(entity),
    officialWebsite: getClaimValue(entity, P.OFFICIAL_WEBSITE),
    imageUrl: getImageUrl(entity),
  };

  cacheSet(cacheKey, bio, CacheTTL.LONG);
  return bio;
}

/**
 * Get artist bio by MusicBrainz ID (convenience function)
 */
export async function getArtistBioByMbid(mbid: string): Promise<WikidataArtistBio | null> {
  const wikidataId = await getWikidataIdByMbid(mbid);
  if (!wikidataId) return null;

  return getArtistBio(wikidataId);
}
