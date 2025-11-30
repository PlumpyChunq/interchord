'use client';

import { useArtistConcerts, Concert, groupConcertsByMonth } from '@/lib/concerts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface UpcomingConcertsProps {
  artistName: string;
  maxDisplay?: number;
}

export function UpcomingConcerts({ artistName, maxDisplay = 5 }: UpcomingConcertsProps) {
  const { concerts, isLoading, error, upcomingCount } = useArtistConcerts(artistName);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TicketIcon className="w-4 h-4" />
            Upcoming Shows
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <LoadingSpinner />
            <span className="ml-2 text-sm text-gray-500">Loading shows...</span>
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
            Upcoming Shows
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">No upcoming shows announced</p>
        </CardContent>
      </Card>
    );
  }

  // Show limited concerts
  const displayedConcerts = concerts.slice(0, maxDisplay);
  const hasMore = concerts.length > maxDisplay;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TicketIcon className="w-4 h-4" />
          Upcoming Shows
          {upcomingCount > 0 && (
            <span className="ml-auto text-xs font-normal bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              {upcomingCount} soon
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
  const isUpcoming = concert.date <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  return (
    <div className="flex items-start gap-3 group">
      <div className={`flex-shrink-0 w-12 text-center ${isUpcoming ? 'text-green-600' : 'text-gray-500'}`}>
        <div className="text-xs uppercase font-medium">
          {concert.date.toLocaleDateString('en-US', { month: 'short' })}
        </div>
        <div className="text-lg font-bold leading-tight">
          {concert.date.getDate()}
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
          Tickets
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

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-gray-400"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
