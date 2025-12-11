// Types for supplementary artist data (Wikipedia-derived)

export interface ArtistSupplement {
  mbid: string;
  name: string;
  wikipediaTitle?: string;
  formationYear?: number;
  formationCity?: string;
  formationState?: string;
  formationCountry?: string;
  wikipediaExtract?: string;
  parsedAt?: Date;
  createdAt: Date;
}

export interface FoundingMember {
  id: number;
  bandMbid: string;
  memberName: string;
  memberMbid?: string;
  instruments?: string[];
  confidence: number;
  matchMethod: 'exact' | 'fuzzy' | 'unmatched';
  createdAt: Date;
}

// Parsed data from Wikipedia before matching
export interface ExtractedBandInfo {
  formationYear?: number;
  formationCity?: string;
  formationState?: string;
  formationCountry?: string;
  foundingMembers: ExtractedMember[];
}

export interface ExtractedMember {
  name: string;
  instruments?: string[];
}

// Result of matching extracted names to MusicBrainz
export interface MatchResult {
  extractedName: string;
  matchedMbid: string | null;
  matchedName: string | null;
  confidence: number;
  method: 'exact' | 'fuzzy' | 'unmatched';
  instruments?: string[];
}

// Combined supplement data for an artist
export interface SupplementData {
  artist?: ArtistSupplement;
  foundingMembers: FoundingMember[];
  foundingMemberMbids: Set<string>;
}
