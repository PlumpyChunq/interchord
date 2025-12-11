/**
 * Name Matching
 *
 * Matches extracted names from Wikipedia against MusicBrainz artist names.
 * Uses exact matching first, then fuzzy matching with Levenshtein distance.
 */

import type { ArtistNode } from '@/types';
import type { ExtractedMember, MatchResult } from './types';

/**
 * Match extracted members against MusicBrainz relationship data
 */
export function matchExtractedMembers(
  extractedMembers: ExtractedMember[],
  relatedArtists: ArtistNode[]
): MatchResult[] {
  const results: MatchResult[] = [];

  for (const extracted of extractedMembers) {
    const match = findBestMatch(extracted.name, relatedArtists);

    results.push({
      extractedName: extracted.name,
      matchedMbid: match?.mbid ?? null,
      matchedName: match?.name ?? null,
      confidence: match?.confidence ?? 0,
      method: match?.method ?? 'unmatched',
      instruments: extracted.instruments,
    });
  }

  return results;
}

interface MatchCandidate {
  mbid: string;
  name: string;
  confidence: number;
  method: 'exact' | 'fuzzy' | 'unmatched';
}

/**
 * Find best matching artist for an extracted name
 */
function findBestMatch(
  extractedName: string,
  candidates: ArtistNode[]
): MatchCandidate | null {
  const normalizedExtracted = normalizeName(extractedName);

  // First pass: exact match (case-insensitive)
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeName(candidate.name);

    if (normalizedExtracted === normalizedCandidate) {
      return {
        mbid: candidate.id,
        name: candidate.name,
        confidence: 1.0,
        method: 'exact',
      };
    }
  }

  // Second pass: fuzzy match (Levenshtein distance)
  let bestFuzzy: MatchCandidate | null = null;
  let bestSimilarity = 0;

  for (const candidate of candidates) {
    const similarity = calculateSimilarity(normalizedExtracted, normalizeName(candidate.name));

    // Threshold: >= 0.8 is a good fuzzy match
    if (similarity >= 0.8 && similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestFuzzy = {
        mbid: candidate.id,
        name: candidate.name,
        confidence: similarity,
        method: 'fuzzy',
      };
    }
  }

  if (bestFuzzy) {
    return bestFuzzy;
  }

  // Third pass: partial match (first name + last name components)
  const extractedParts = normalizedExtracted.split(' ');
  if (extractedParts.length >= 2) {
    const firstName = extractedParts[0];
    const lastName = extractedParts[extractedParts.length - 1];

    for (const candidate of candidates) {
      const candidateParts = normalizeName(candidate.name).split(' ');
      if (candidateParts.length >= 2) {
        const candFirst = candidateParts[0];
        const candLast = candidateParts[candidateParts.length - 1];

        // Match if first and last names match
        if (firstName === candFirst && lastName === candLast) {
          return {
            mbid: candidate.id,
            name: candidate.name,
            confidence: 0.9,
            method: 'fuzzy',
          };
        }
      }
    }
  }

  return null;
}

/**
 * Normalize a name for comparison
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD') // Decompose accents
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z\s]/g, '') // Remove non-letters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Calculate similarity between two strings (0.0 - 1.0)
 * Uses Levenshtein distance normalized by max length
 */
function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  if (a.length === 0 || b.length === 0) return 0;

  const distance = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);

  return 1 - distance / maxLen;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;

  // Create matrix
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // Fill matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // deletion
          dp[i][j - 1],     // insertion
          dp[i - 1][j - 1]  // substitution
        );
      }
    }
  }

  return dp[m][n];
}
