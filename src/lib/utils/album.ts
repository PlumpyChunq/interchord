/**
 * Album-related utility functions
 */

/**
 * Normalize album title for deduplication
 * Removes edition markers, subtitles, punctuation differences, etc.
 *
 * Examples:
 * - "Chocolate and Cheese" -> "chocolate cheese"
 * - "Chocolate & Cheese" -> "chocolate cheese"
 * - "Chocolate and Cheese (Deluxe Edition)" -> "chocolate cheese"
 * - "God Ween Satan: The Oneness" -> "god ween satan"
 * - "GodWeenSatan" -> "god ween satan"
 */
export function normalizeAlbumTitle(title: string): string {
  return title
    // Remove subtitles (everything after colon or dash with spaces)
    .replace(/\s*[:–—-]\s+.*$/, '')
    // Add spaces before capitals in camelCase (GodWeenSatan -> God Ween Satan)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    // Remove ALL parentheticals (handles editions, regions, etc.)
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    // Remove ALL brackets
    .replace(/\s*\[[^\]]*\]\s*/g, ' ')
    // Normalize ampersand to 'and' (handle various ampersand chars)
    .replace(/\s*[&\u0026\uFF06]+\s*/g, ' and ')
    // Remove 'and' and 'the' for looser matching
    .replace(/\b(and|the)\b/g, ' ')
    // Remove all non-alphanumeric
    .replace(/[^a-z0-9\s]/g, '')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generate a deduplication key for an album
 * Combines normalized title with year for unique identification
 */
export function getAlbumDedupeKey(title: string, year: string | number | null | undefined): string {
  const normalizedTitle = normalizeAlbumTitle(title);
  const yearStr = year?.toString()?.substring(0, 4) || 'unknown';
  return `${normalizedTitle}|${yearStr}`;
}
