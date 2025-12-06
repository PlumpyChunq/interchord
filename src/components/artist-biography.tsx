'use client';

import { useArtistBio } from '@/lib/wikidata';
import type { WikidataArtistBio, WikidataPlace } from '@/lib/wikidata';

interface ArtistBiographyProps {
  mbid: string;
  artistName: string;
}

/**
 * Format a date string for display
 */
function formatDate(dateStr: string | undefined): string | null {
  if (!dateStr) return null;

  // Handle partial dates (YYYY or YYYY-MM)
  const parts = dateStr.split('-');
  if (parts.length === 1) {
    return parts[0]; // Just year
  }

  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: parts.length === 3 ? 'numeric' : undefined,
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format a place for display
 */
function formatPlace(place: WikidataPlace | undefined): string | null {
  if (!place) return null;

  if (place.country && place.name !== place.country) {
    return `${place.name}, ${place.country}`;
  }
  return place.name;
}

/**
 * Calculate age from birth and optional death date
 */
function calculateAge(birthDate: string | undefined, deathDate: string | undefined): number | null {
  if (!birthDate) return null;

  const birth = new Date(birthDate);
  const end = deathDate ? new Date(deathDate) : new Date();

  let age = end.getFullYear() - birth.getFullYear();
  const monthDiff = end.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && end.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}

function BiographyRow({
  label,
  value,
  link,
}: {
  label: string;
  value: string | null | undefined;
  link?: string;
}) {
  if (!value) return null;

  return (
    <div className="flex justify-between items-start py-1.5 border-b border-gray-100 last:border-b-0">
      <span className="text-xs text-gray-500 flex-shrink-0">{label}</span>
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline text-right ml-2 truncate"
        >
          {value}
        </a>
      ) : (
        <span className="text-xs text-gray-900 text-right ml-2">{value}</span>
      )}
    </div>
  );
}

function BiographyContent({ bio }: { bio: WikidataArtistBio }) {
  const birthDate = formatDate(bio.birthDate);
  const deathDate = formatDate(bio.deathDate);
  const birthPlace = formatPlace(bio.birthPlace);
  const deathPlace = formatPlace(bio.deathPlace);
  const age = calculateAge(bio.birthDate, bio.deathDate);

  const spouseNames = bio.spouses?.map((s) => s.name).join(', ');
  const childrenCount = bio.children?.length;

  return (
    <div className="space-y-1">
      {/* Birth info */}
      <BiographyRow label="Born" value={birthDate} />
      <BiographyRow label="Birthplace" value={birthPlace} />

      {/* Death info (if applicable) */}
      {deathDate && (
        <>
          <BiographyRow
            label="Died"
            value={age ? `${deathDate} (age ${age})` : deathDate}
          />
          <BiographyRow label="Death place" value={deathPlace} />
        </>
      )}

      {/* Age for living people */}
      {!deathDate && age && (
        <BiographyRow label="Age" value={`${age} years old`} />
      )}

      {/* Family */}
      {spouseNames && <BiographyRow label="Spouse(s)" value={spouseNames} />}
      {childrenCount && childrenCount > 0 && (
        <BiographyRow label="Children" value={String(childrenCount)} />
      )}

      {/* Links */}
      <div className="pt-2 flex gap-2 flex-wrap">
        {bio.wikipediaUrl && (
          <a
            href={bio.wikipediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 transition-colors"
          >
            Wikipedia
          </a>
        )}
        {bio.officialWebsite && (
          <a
            href={bio.officialWebsite}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 transition-colors"
          >
            Official Site
          </a>
        )}
      </div>
    </div>
  );
}

export function ArtistBiography({ mbid, artistName }: ArtistBiographyProps) {
  const { data: bio, isLoading, error } = useArtistBio(mbid);

  if (isLoading) {
    return (
      <div className="text-xs text-gray-400 py-2">
        Loading biography...
      </div>
    );
  }

  if (error || !bio) {
    return (
      <div className="text-xs text-gray-400 py-2">
        No biographical data found for {artistName}
      </div>
    );
  }

  return <BiographyContent bio={bio} />;
}
