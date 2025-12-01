'use client';

import { useArtistConcerts, Concert, RECENT_THRESHOLD_MS } from '@/lib/concerts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RecentShowsProps {
  artistName: string;
  /** MusicBrainz ID for exact matching (prevents "Ween" returning "Helloween") */
  mbid?: string;
  maxDisplay?: number;
}

export function RecentConcerts({ artistName, mbid, maxDisplay = 5 }: RecentShowsProps) {
  const { concerts, isLoading, error, recentCount } = useArtistConcerts(artistName, mbid);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TicketIcon className="w-4 h-4" />
            Recent Shows
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            <ConcertSkeleton />
            <ConcertSkeleton />
            <ConcertSkeleton />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return null; // Silently fail - concerts are supplementary info
  }

  if (concerts.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TicketIcon className="w-4 h-4" />
            Recent Shows
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">No recent shows found</p>
        </CardContent>
      </Card>
    );
  }

  // Show limited concerts (most recent first)
  const displayedConcerts = concerts.slice(0, maxDisplay);
  const hasMore = concerts.length > maxDisplay;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TicketIcon className="w-4 h-4" />
          Recent Shows
          {recentCount > 0 && (
            <span className="ml-auto text-xs font-normal bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              {recentCount} in last 90 days
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {displayedConcerts.map((concert) => (
            <ConcertItem key={concert.id} concert={concert} />
          ))}
        </div>
        {hasMore && (
          <p className="text-xs text-gray-500 mt-3 text-center">
            +{concerts.length - maxDisplay} more shows
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ConcertItem({ concert }: { concert: Concert }) {
  const now = new Date();
  const threshold = new Date(now.getTime() - RECENT_THRESHOLD_MS);
  const isRecent = concert.date >= threshold;

  return (
    <div className="flex items-start gap-3 group">
      <div className={`flex-shrink-0 w-12 text-center ${isRecent ? 'text-blue-600' : 'text-gray-500'}`}>
        <div className="text-xs uppercase font-medium">
          {concert.date.toLocaleDateString('en-US', { month: 'short' })}
        </div>
        <div className="text-lg font-bold leading-tight">
          {concert.date.getDate()}
        </div>
        <div className="text-xs text-gray-400">
          {concert.date.getFullYear()}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {concert.venue}
        </p>
        <p className="text-xs text-gray-500 truncate">
          {concert.city}
          {concert.region && `, ${concert.region}`}
          {concert.country && concert.country !== 'United States' && ` - ${concert.country}`}
        </p>
      </div>
      {concert.ticketUrl && (
        <a
          href={concert.ticketUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 text-xs text-blue-600 hover:text-blue-800 hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
        >
          Setlist
        </a>
      )}
    </div>
  );
}

function TicketIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
      />
    </svg>
  );
}

/** Skeleton loading state that mimics the ConcertItem layout */
function ConcertSkeleton() {
  return (
    <div className="flex items-start gap-3 animate-pulse">
      {/* Date skeleton */}
      <div className="flex-shrink-0 w-12 text-center">
        <div className="h-3 w-8 mx-auto bg-gray-200 rounded mb-1" />
        <div className="h-5 w-6 mx-auto bg-gray-200 rounded" />
      </div>
      {/* Venue info skeleton */}
      <div className="flex-1 min-w-0">
        <div className="h-4 w-3/4 bg-gray-200 rounded mb-2" />
        <div className="h-3 w-1/2 bg-gray-200 rounded" />
      </div>
    </div>
  );
}
