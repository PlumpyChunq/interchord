'use client';

import { useState, useEffect, useCallback } from 'react';
import { getServerStatus, type MusicBrainzServerStatus } from '@/lib/musicbrainz';

/**
 * Small, discrete indicator showing MusicBrainz server status
 * Shows local/remote status and response time stats
 */
export function MusicBrainzStatus() {
  // Initialize with current status
  const [status, setStatus] = useState<MusicBrainzServerStatus>(() => getServerStatus());

  const refreshStatus = useCallback(() => {
    setStatus(getServerStatus());
  }, []);

  useEffect(() => {
    // Poll for updates every 2 seconds
    const interval = setInterval(refreshStatus, 2000);
    return () => clearInterval(interval);
  }, [refreshStatus]);

  const isLocal = status.isLocal;
  const avgMs = status.stats.avgResponseTime;
  const lastMs = status.stats.lastResponseTime;
  const reqCount = status.stats.requestCount;

  // Color based on status
  const dotColor = isLocal
    ? 'bg-green-500'
    : status.didFallback
      ? 'bg-yellow-500'
      : 'bg-blue-500';

  const statusLabel = isLocal
    ? 'Local'
    : status.didFallback
      ? 'Fallback'
      : 'Remote';

  // Build tooltip text
  const tooltipLines = [
    `MusicBrainz ${isLocal ? 'Local Server' : 'Public API'}`,
    status.serverUrl,
    '',
    reqCount > 0 ? `Requests: ${reqCount}` : '',
    reqCount > 0 ? `Avg: ${avgMs}ms | Last: ${lastMs}ms` : '',
    status.didFallback ? '⚠ Fell back from local' : '',
    !isLocal && !status.didFallback ? '⏱ Rate limited: 1 req/sec' : '',
  ].filter(Boolean).join('\n');

  return (
    <div
      className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-default select-none opacity-50 hover:opacity-100 transition-opacity"
      title={tooltipLines}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor} animate-pulse`} />
      <span className="font-mono text-[10px]">{statusLabel}</span>
      {reqCount > 0 && (
        <span className="font-mono text-[10px] text-muted-foreground/70">
          {lastMs}ms
        </span>
      )}
    </div>
  );
}
