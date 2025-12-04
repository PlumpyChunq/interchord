'use client';

import { useState, useEffect, useCallback } from 'react';
import { getServerStatus, forceRecoveryCheck, type MusicBrainzServerStatus } from '@/lib/musicbrainz';

/**
 * Small, discrete indicator showing MusicBrainz server status
 * Shows local/remote status, response time stats, and recovery status
 */
export function MusicBrainzStatus() {
  // Initialize with current status
  const [status, setStatus] = useState<MusicBrainzServerStatus>(() => getServerStatus());
  const [isCheckingRecovery, setIsCheckingRecovery] = useState(false);

  const refreshStatus = useCallback(() => {
    setStatus(getServerStatus());
  }, []);

  useEffect(() => {
    // Poll for updates every 2 seconds
    const interval = setInterval(refreshStatus, 2000);
    return () => clearInterval(interval);
  }, [refreshStatus]);

  const handleRetryClick = async () => {
    if (isCheckingRecovery) return;
    setIsCheckingRecovery(true);
    await forceRecoveryCheck();
    refreshStatus();
    setIsCheckingRecovery(false);
  };

  const isLocal = status.isLocal;
  const inFallback = status.inFallbackMode;
  const lastMs = status.stats.lastResponseTime;
  const reqCount = status.stats.requestCount;

  // Color based on status
  const dotColor = isLocal
    ? 'bg-green-500'
    : inFallback
      ? 'bg-yellow-500'
      : 'bg-blue-500';

  const statusLabel = isLocal
    ? 'Local'
    : inFallback
      ? 'Fallback'
      : 'Remote';

  // Build tooltip text
  const tooltipLines = [
    `MusicBrainz ${isLocal ? 'Local Server' : 'Public API'}`,
    status.serverUrl,
    '',
    reqCount > 0 ? `Requests: ${reqCount}` : '',
    reqCount > 0 ? `Avg: ${status.stats.avgResponseTime}ms | Last: ${lastMs}ms` : '',
    inFallback ? '⚠ Local server unavailable - using fallback' : '',
    inFallback && status.nextHealthCheckIn !== null
      ? `🔄 Auto-retry in ${Math.ceil(status.nextHealthCheckIn / 1000)}s`
      : '',
    !isLocal && !inFallback ? '⏱ Rate limited: 1 req/sec' : '',
  ].filter(Boolean).join('\n');

  return (
    <div
      className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-default select-none opacity-50 hover:opacity-100 transition-opacity"
      title={tooltipLines}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor} ${isCheckingRecovery ? '' : 'animate-pulse'}`} />
      <span className="font-mono text-[10px]">{statusLabel}</span>
      {reqCount > 0 && (
        <span className="font-mono text-[10px] text-muted-foreground/70">
          {lastMs}ms
        </span>
      )}
      {inFallback && (
        <button
          onClick={handleRetryClick}
          disabled={isCheckingRecovery}
          className="font-mono text-[10px] text-yellow-500 hover:text-yellow-400 underline cursor-pointer disabled:opacity-50"
          title="Click to check if local server is available"
        >
          {isCheckingRecovery ? '...' : 'retry'}
        </button>
      )}
    </div>
  );
}
