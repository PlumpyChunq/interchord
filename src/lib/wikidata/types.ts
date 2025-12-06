/**
 * Wikidata types for artist biographical data
 */

export interface WikidataCoordinates {
  latitude: number;
  longitude: number;
}

export interface WikidataPlace {
  id: string;           // Q-ID (e.g., "Q60" for New York City)
  name: string;
  coordinates?: WikidataCoordinates;
  country?: string;
}

export interface WikidataPerson {
  id: string;           // Q-ID
  name: string;
}

export interface WikidataArtistBio {
  wikidataId: string;   // Q-ID (e.g., "Q42775" for Johnny Cash)
  name: string;
  description?: string;

  // Birth/Death
  birthDate?: string;   // ISO date string
  birthPlace?: WikidataPlace;
  deathDate?: string;
  deathPlace?: WikidataPlace;

  // Family
  spouses?: WikidataPerson[];
  children?: WikidataPerson[];

  // External links
  wikipediaUrl?: string;
  officialWebsite?: string;

  // Image
  imageUrl?: string;
}

/**
 * Wikidata property IDs we care about
 */
export const WIKIDATA_PROPERTIES = {
  // Basic info
  INSTANCE_OF: 'P31',           // What type of entity
  IMAGE: 'P18',                 // Image filename

  // Birth/Death
  DATE_OF_BIRTH: 'P569',
  PLACE_OF_BIRTH: 'P19',
  DATE_OF_DEATH: 'P570',
  PLACE_OF_DEATH: 'P20',

  // Family
  SPOUSE: 'P26',
  CHILD: 'P40',

  // Location data
  COORDINATES: 'P625',
  COUNTRY: 'P17',

  // External IDs
  MUSICBRAINZ_ARTIST_ID: 'P434',
  OFFICIAL_WEBSITE: 'P856',
} as const;
