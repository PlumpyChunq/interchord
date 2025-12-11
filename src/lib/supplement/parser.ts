/**
 * Wikipedia Text Parser
 *
 * Extracts structured information from Wikipedia band/artist article intros.
 * Uses regex patterns tailored to common Wikipedia writing conventions.
 */

import type { ExtractedBandInfo, ExtractedMember } from './types';

// Common instruments to detect in parenthetical descriptions
const INSTRUMENT_KEYWORDS = [
  'vocals', 'lead vocals', 'backing vocals', 'singer',
  'guitar', 'lead guitar', 'rhythm guitar', 'bass guitar', 'acoustic guitar',
  'bass', 'drums', 'percussion', 'keyboards', 'keyboard', 'piano',
  'synthesizer', 'synth', 'saxophone', 'trumpet', 'violin', 'cello',
  'harmonica', 'banjo', 'mandolin', 'flute', 'clarinet',
];

/**
 * Parse Wikipedia intro text to extract band information
 */
export function parseWikipediaIntro(text: string): ExtractedBandInfo {
  const result: ExtractedBandInfo = {
    foundingMembers: [],
  };

  // Clean up the text
  const cleanText = text
    .replace(/\[\d+\]/g, '') // Remove citation markers [1], [2], etc.
    .replace(/\s+/g, ' ')    // Normalize whitespace
    .trim();

  // Extract formation year
  result.formationYear = extractFormationYear(cleanText);

  // Extract formation location
  const location = extractFormationLocation(cleanText);
  if (location) {
    result.formationCity = location.city;
    result.formationState = location.state;
    result.formationCountry = location.country;
  }

  // Extract founding members
  result.foundingMembers = extractFoundingMembers(cleanText);

  return result;
}

/**
 * Extract formation year from text
 */
function extractFormationYear(text: string): number | undefined {
  // Pattern: "formed in YYYY" or "founded in YYYY"
  const formYearMatch = text.match(/(?:formed|founded|established)\s+(?:in\s+)?(\d{4})/i);
  if (formYearMatch) {
    return parseInt(formYearMatch[1], 10);
  }

  // Pattern: "...by Name and Name in YYYY"
  const byYearMatch = text.match(/by\s+.+?\s+in\s+(\d{4})/i);
  if (byYearMatch) {
    return parseInt(byYearMatch[1], 10);
  }

  // Pattern: "since YYYY" or "active since YYYY"
  const sinceMatch = text.match(/(?:active\s+)?since\s+(\d{4})/i);
  if (sinceMatch) {
    return parseInt(sinceMatch[1], 10);
  }

  return undefined;
}

/**
 * Extract formation location (city, state, country)
 */
function extractFormationLocation(text: string): {
  city?: string;
  state?: string;
  country?: string;
} | undefined {
  // Pattern: "formed in City, State" or "formed in City, Country"
  // Examples:
  //   "formed in San Antonio, Texas"
  //   "formed in London, England"
  //   "formed in Seattle, Washington, United States"
  const locationMatch = text.match(
    /(?:formed|founded|based)\s+in\s+([A-Z][a-zA-Z\s]+?)(?:,\s*([A-Z][a-zA-Z\s]+?))?(?:,\s*([A-Z][a-zA-Z\s]+?))?(?:\s+(?:by|in\s+\d))/i
  );

  if (locationMatch) {
    const parts = [locationMatch[1], locationMatch[2], locationMatch[3]]
      .filter(Boolean)
      .map((p) => p?.trim());

    if (parts.length === 1) {
      // Just city or country
      return { city: parts[0] };
    } else if (parts.length === 2) {
      // City, State/Country
      return { city: parts[0], state: parts[1] };
    } else if (parts.length === 3) {
      // City, State, Country
      return { city: parts[0], state: parts[1], country: parts[2] };
    }
  }

  // Simpler pattern: "from City" at beginning
  const fromMatch = text.match(/^[A-Za-z\s]+ (?:is|are|was|were) an? [A-Za-z\s]+ (?:band|group|duo|trio) from ([A-Z][a-zA-Z\s]+?)(?:,\s*([A-Z][a-zA-Z\s]+?))?[.,]/i);
  if (fromMatch) {
    return {
      city: fromMatch[1]?.trim(),
      state: fromMatch[2]?.trim(),
    };
  }

  return undefined;
}

/**
 * Extract founding member names from text
 */
function extractFoundingMembers(text: string): ExtractedMember[] {
  const members: ExtractedMember[] = [];
  const seenNames = new Set<string>();

  // Pattern 1: "formed by Name and Name" or "formed by Name, Name, and Name"
  // Examples:
  //   "formed by Gibby Haynes and Paul Leary"
  //   "formed by Kurt Cobain, Krist Novoselic, and Dave Grohl"
  const formedByMatch = text.match(
    /(?:formed|founded|started|created)\s+(?:in\s+[\w\s,]+\s+)?by\s+([^.]+?)(?:\s+in\s+\d{4}|\.|,\s*(?:the|who|which|and\s+(?:is|are|was|were)))/i
  );

  if (formedByMatch) {
    const namesSection = formedByMatch[1];
    const extracted = extractNamesFromList(namesSection);
    for (const member of extracted) {
      if (!seenNames.has(member.name.toLowerCase())) {
        seenNames.add(member.name.toLowerCase());
        members.push(member);
      }
    }
  }

  // Pattern 2: "founders Name and Name"
  const foundersMatch = text.match(/founders?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?(?:\s+and\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)+)/i);
  if (foundersMatch && members.length === 0) {
    const extracted = extractNamesFromList(foundersMatch[1]);
    for (const member of extracted) {
      if (!seenNames.has(member.name.toLowerCase())) {
        seenNames.add(member.name.toLowerCase());
        members.push(member);
      }
    }
  }

  // Pattern 3: Names with instruments in parentheses
  // Examples:
  //   "Gibby Haynes (vocals) and Paul Leary (guitar)"
  const instrumentPattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*\(([^)]+)\)/g;
  let instrMatch;
  while ((instrMatch = instrumentPattern.exec(text)) !== null) {
    const name = instrMatch[1].trim();
    const parenContent = instrMatch[2].toLowerCase();

    // Check if parenthetical contains instruments
    const hasInstrument = INSTRUMENT_KEYWORDS.some((instr) =>
      parenContent.includes(instr)
    );

    if (hasInstrument && !seenNames.has(name.toLowerCase())) {
      seenNames.add(name.toLowerCase());
      members.push({
        name,
        instruments: extractInstrumentsFromText(parenContent),
      });
    }
  }

  return members;
}

/**
 * Extract names from a comma/and separated list
 * "Gibby Haynes and Paul Leary" -> [{name: "Gibby Haynes"}, {name: "Paul Leary"}]
 */
function extractNamesFromList(text: string): ExtractedMember[] {
  const members: ExtractedMember[] = [];

  // Split on " and " and ", "
  const parts = text
    .split(/\s+and\s+|,\s*/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  for (const part of parts) {
    // Extract name and optional instruments
    const withInstrMatch = part.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*(?:\(([^)]+)\))?/);

    if (withInstrMatch) {
      const name = withInstrMatch[1].trim();
      const instruments = withInstrMatch[2]
        ? extractInstrumentsFromText(withInstrMatch[2])
        : undefined;

      // Validate it looks like a person name (at least first and last name)
      if (isValidPersonName(name)) {
        members.push({ name, instruments });
      }
    }
  }

  return members;
}

/**
 * Check if a string looks like a valid person name
 */
function isValidPersonName(name: string): boolean {
  // Must have at least two words (first and last name)
  const words = name.split(/\s+/);
  if (words.length < 2) return false;

  // Each word should start with uppercase
  for (const word of words) {
    if (!/^[A-Z]/.test(word)) return false;
  }

  // Filter out common false positives
  const lowerName = name.toLowerCase();
  const falsePositives = [
    'the band', 'the group', 'the duo', 'rock band', 'punk band',
    'heavy metal', 'united states', 'new york', 'los angeles',
    'san francisco', 'new jersey',
  ];

  for (const fp of falsePositives) {
    if (lowerName.includes(fp)) return false;
  }

  return true;
}

/**
 * Extract instrument names from text
 */
function extractInstrumentsFromText(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];

  for (const instr of INSTRUMENT_KEYWORDS) {
    if (lower.includes(instr)) {
      // Normalize to simpler form
      const normalized = normalizeInstrument(instr);
      if (!found.includes(normalized)) {
        found.push(normalized);
      }
    }
  }

  return found;
}

/**
 * Normalize instrument names to consistent form
 */
function normalizeInstrument(instrument: string): string {
  const mappings: Record<string, string> = {
    'lead vocals': 'vocals',
    'backing vocals': 'vocals',
    'singer': 'vocals',
    'lead guitar': 'guitar',
    'rhythm guitar': 'guitar',
    'bass guitar': 'bass',
    'acoustic guitar': 'guitar',
    'synthesizer': 'keyboards',
    'synth': 'keyboards',
    'keyboard': 'keyboards',
  };

  return mappings[instrument] || instrument;
}
