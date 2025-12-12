// Hook for reactive favorites state
export { useFavorites, FAVORITES_KEY } from './hooks';
export type { StoredArtist } from './hooks';

// Standalone utility functions (for use outside React components)
export {
  addToFavorites,
  removeFromFavorites,
  isFavorite,
  getFavorites,
  enrichFavoriteGenres,
} from './utils';
