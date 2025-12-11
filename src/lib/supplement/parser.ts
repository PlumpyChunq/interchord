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
  // Pattern: "formed in City, State, by ..." or "formed in City, State in YYYY"
  // Examples:
  //   "formed in San Antonio, Texas, by ..."
  //   "formed in London, England in 1985"
  //   "formed in Seattle, Washington, United States"

  // Two-step approach: first find the verb phrase, then extract location parts
  // This avoids /i flag issues with [A-Z] character classes
  const verbMatch = text.match(/(?:formed|founded|based)\s+in\s+/i);
  if (!verbMatch || verbMatch.index === undefined) {
    return undefined;
  }

  // Get text after "formed in "
  const afterVerb = text.slice(verbMatch.index + verbMatch[0].length);

  // Extract location parts: comma-separated words starting with uppercase
  // Stop at: ", by " or " by " or " in YYYY" or end of sentence
  const locationMatch = afterVerb.match(
    /^([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*(?:,\s*[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)*)(?:,?\s+by\s|\s+in\s+\d{4}|[.,]|$)/
  );

  if (!locationMatch) {
    return undefined;
  }

  const locationString = locationMatch[1];

  // Split by comma and clean up
  const parts = locationString
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && /^[A-Z]/.test(p)); // Must start with uppercase

  if (parts.length === 1) {
    return { city: parts[0] };
  } else if (parts.length === 2) {
    return { city: parts[0], state: parts[1] };
  } else if (parts.length >= 3) {
    return { city: parts[0], state: parts[1], country: parts[2] };
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

// Common role prefixes that appear before names in Wikipedia
const ROLE_PREFIXES = [
  'singer', 'vocalist', 'lead singer', 'frontman', 'frontwoman',
  'guitarist', 'lead guitarist', 'rhythm guitarist', 'bassist', 'bass player',
  'drummer', 'percussionist', 'keyboardist', 'pianist', 'saxophonist',
  'musician', 'multi-instrumentalist', 'producer', 'songwriter',
  'founding member', 'co-founder', 'founder',
];

/**
 * Strip role prefixes from a name string
 * "singer Gibby Haynes" -> "Gibby Haynes"
 * "guitarist Paul Leary" -> "Paul Leary"
 */
function stripRolePrefix(text: string): { name: string; role?: string } {
  const lower = text.toLowerCase();

  for (const prefix of ROLE_PREFIXES) {
    if (lower.startsWith(prefix + ' ')) {
      return {
        name: text.slice(prefix.length + 1).trim(),
        role: prefix,
      };
    }
  }

  return { name: text };
}

/**
 * Extract names from a comma/and separated list
 * "Gibby Haynes and Paul Leary" -> [{name: "Gibby Haynes"}, {name: "Paul Leary"}]
 * "singer Gibby Haynes and guitarist Paul Leary" -> same result (strips roles)
 */
function extractNamesFromList(text: string): ExtractedMember[] {
  const members: ExtractedMember[] = [];

  // Split on " and " and ", "
  const parts = text
    .split(/\s+and\s+|,\s*/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  for (const part of parts) {
    // Strip role prefix first (e.g., "singer Gibby Haynes" -> "Gibby Haynes")
    const { name: strippedPart, role } = stripRolePrefix(part);

    // Extract name and optional instruments in parentheses
    const withInstrMatch = strippedPart.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*(?:\(([^)]+)\))?/);

    if (withInstrMatch) {
      const name = withInstrMatch[1].trim();
      let instruments = withInstrMatch[2]
        ? extractInstrumentsFromText(withInstrMatch[2])
        : undefined;

      // If we stripped a role that's an instrument, add it
      if (role && !instruments) {
        const roleInstrument = extractInstrumentsFromText(role);
        if (roleInstrument.length > 0) {
          instruments = roleInstrument;
        }
      }

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
