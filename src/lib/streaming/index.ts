export {
  type StreamingService,
  type MusicService,
  type StreamingServiceInfo,
  STREAMING_SERVICES,
  getStreamingPreference,
  setStreamingPreference,
  getPreferredService,
  getAlbumStreamingUrl,
  getArtistStreamingUrl,
  getPrimaryMusicService,
  setPrimaryMusicService,
} from './preferences';

export { useStreamingPreference, useAlbumStreamingUrl } from './hooks';
