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
  const venueWikiUrl = `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(`${concert.venue} ${concert.city} venue`)}`;

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
        <div className="flex items-center gap-1">
          <p className="text-sm font-medium truncate">
            {concert.venue}
          </p>
          <a
            href={venueWikiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-blue-600 transition-colors flex-shrink-0"
            title={`Wikipedia: ${concert.venue}`}
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.09 13.119c-.936 1.932-2.217 4.548-2.853 5.728-.616 1.074-1.127.931-1.532.029-1.406-3.321-4.293-9.144-5.651-12.409-.251-.601-.441-.987-.619-1.139-.181-.15-.554-.24-1.122-.271C.103 5.033 0 4.982 0 4.898v-.455l.052-.045c.924-.005 5.401 0 5.401 0l.051.045v.434c0 .119-.075.176-.225.176l-.564.031c-.485.029-.727.164-.727.436 0 .135.053.33.166.601 1.082 2.646 4.818 10.521 4.818 10.521l.136.046 2.411-4.81-.482-1.067-1.658-3.264s-.318-.654-.428-.872c-.728-1.443-.712-1.518-1.447-1.617-.207-.023-.313-.05-.313-.149v-.468l.06-.045h4.292l.113.037v.451c0 .105-.076.15-.227.15l-.308.047c-.792.061-.661.381-.136 1.422l1.582 3.252 1.758-3.504c.293-.64.233-.801.111-.947-.07-.084-.305-.22-.812-.24l-.201-.021c-.052 0-.098-.015-.145-.051-.045-.031-.067-.076-.067-.129v-.427l.061-.045c1.247-.008 4.043 0 4.043 0l.059.045v.436c0 .121-.059.178-.193.178-.646.03-.782.095-1.023.439-.12.186-.375.589-.646 1.039l-2.301 4.273-.065.135 2.792 5.712.17.048 4.396-10.438c.154-.422.129-.722-.064-.895-.197-.172-.346-.273-.857-.295l-.42-.016c-.061 0-.105-.014-.152-.045-.043-.029-.072-.075-.072-.119v-.436l.059-.045h4.961l.041.045v.437c0 .119-.074.18-.209.18-.648.03-1.127.18-1.443.421-.314.255-.557.616-.736 1.067 0 0-4.043 9.258-5.426 12.339-.525 1.007-1.053.917-1.503-.031-.571-1.171-1.773-3.786-2.646-5.71l.053-.036z"/>
            </svg>
          </a>
        </div>
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
