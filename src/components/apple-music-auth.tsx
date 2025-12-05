'use client';

import { useEffect, useState } from 'react';
import { Music, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppleMusicAuth } from '@/lib/apple-music';
import { importManager } from '@/lib/apple-music/import-manager';

interface AppleMusicAuthProps {
  onImportComplete?: () => void;
}

export function AppleMusicAuth({ onImportComplete }: AppleMusicAuthProps) {
  const { isAuthorized, isLoading, error, connect, disconnect } = useAppleMusicAuth();
  const [importStatus, setImportStatus] = useState(importManager.getStatus());

  // Subscribe to import manager status updates
  useEffect(() => {
    const unsubscribe = importManager.subscribe((status) => {
      setImportStatus(status);
      // Notify parent when import completes
      if (!status.isImporting && status.message?.includes('Added')) {
        onImportComplete?.();
      }
    });
    return unsubscribe;
  }, [onImportComplete]);

  // Trigger import after authorization (uses singleton, survives unmount)
  useEffect(() => {
    if (isAuthorized && !importManager.isImportComplete() && !importManager.isImporting()) {
      // No callbacks needed - import manager writes directly to localStorage
      importManager.startImport();
    }
  }, [isAuthorized]);

  const handleConnect = async () => {
    await connect();
  };

  const handleDisconnect = async () => {
    await disconnect();
    importManager.reset();
  };

  if (isLoading) {
    return (
      <Button variant="outline" disabled>
        <Loader2 className="animate-spin" />
        Loading...
      </Button>
    );
  }

  if (isAuthorized) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleDisconnect}
            className="text-green-600 border-green-600 hover:bg-green-50 dark:text-green-400 dark:border-green-400 dark:hover:bg-green-950"
          >
            <Check className="size-4" />
            Apple Music Connected
          </Button>
        </div>
        {(importStatus.isImporting || importStatus.message) && (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            {importStatus.isImporting && <Loader2 className="size-3 animate-spin" />}
            <span>
              {importStatus.message}
              {importStatus.progress && (
                <span className="ml-1 text-xs">
                  ({importStatus.progress.current}/{importStatus.progress.total})
                </span>
              )}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="outline" onClick={handleConnect}>
        <Music className="size-4" />
        Connect Apple Music
      </Button>
      {error && (
        <p className="text-sm text-destructive">{error.message}</p>
      )}
    </div>
  );
}
