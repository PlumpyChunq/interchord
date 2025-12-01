import type { MusicKitInstance } from './types';

const APP_NAME = 'InterChord';
const APP_BUILD = '1.0.0';

let musicKitInstance: MusicKitInstance | null = null;
let initializationPromise: Promise<MusicKitInstance> | null = null;

async function fetchDeveloperToken(): Promise<string> {
  const response = await fetch('/api/apple-music/token');
  if (!response.ok) {
    throw new Error('Failed to fetch developer token');
  }
  const data = await response.json();
  return data.token;
}

export async function initializeMusicKit(): Promise<MusicKitInstance> {
  // Return existing instance if already initialized
  if (musicKitInstance) {
    return musicKitInstance;
  }

  // Return existing initialization promise if in progress
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    // Wait for MusicKit to be available
    if (typeof window === 'undefined' || !window.MusicKit) {
      // Wait for script to load
      await new Promise<void>((resolve, reject) => {
        const maxWait = 10000;
        const startTime = Date.now();

        const checkMusicKit = () => {
          if (window.MusicKit) {
            resolve();
          } else if (Date.now() - startTime > maxWait) {
            reject(new Error('MusicKit failed to load'));
          } else {
            setTimeout(checkMusicKit, 100);
          }
        };

        checkMusicKit();
      });
    }

    const developerToken = await fetchDeveloperToken();

    musicKitInstance = await window.MusicKit!.configure({
      developerToken,
      app: {
        name: APP_NAME,
        build: APP_BUILD,
      },
    });

    return musicKitInstance;
  })();

  try {
    return await initializationPromise;
  } catch (error) {
    initializationPromise = null;
    throw error;
  }
}

export function getMusicKitInstance(): MusicKitInstance | null {
  return musicKitInstance;
}

export function isMusicKitAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.MusicKit;
}
