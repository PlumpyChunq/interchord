'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
  StreamingService,
  getStreamingPreference,
  setStreamingPreference,
  STREAMING_SERVICES,
} from './preferences';

// Store for sync external store pattern
let listeners: Array<() => void> = [];

function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}

function getSnapshot(): StreamingService {
  if (typeof window === 'undefined') return 'apple-music';
  return getStreamingPreference();
}

function getServerSnapshot(): StreamingService {
  return 'apple-music';
}

// Listen for preference changes
if (typeof window !== 'undefined') {
  window.addEventListener('streaming-preference-changed', () => {
    listeners.forEach(listener => listener());
  });
}

/**
 * Hook to manage streaming service preference
 */
export function useStreamingPreference() {
  const service = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const updatePreference = useCallback((newService: StreamingService) => {
    setStreamingPreference(newService);
  }, []);

  const serviceInfo = STREAMING_SERVICES[service];

  return {
    service,
    serviceInfo,
    setService: updatePreference,
    isLoaded: true,
    allServices: Object.values(STREAMING_SERVICES),
  };
}

/**
 * Hook to get streaming URLs for an album
 */
export function useAlbumStreamingUrl(artistName: string, albumName: string) {
  const { serviceInfo, isLoaded } = useStreamingPreference();

  if (!isLoaded) {
    return null;
  }

  return serviceInfo.getAlbumUrl(artistName, albumName);
}
