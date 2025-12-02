'use client';

import { useMemo, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, GripVertical, Plus, X } from 'lucide-react';
import {
  DEFAULT_GENRE_ORDER,
  GENRE_COLORS,
  DEFAULT_COLORS,
  useGenrePreferences,
} from '@/lib/genres';

interface StoredArtist {
  id: string;
  name: string;
  type: string;
  country?: string;
  genres?: string[];
  overrideGenre?: string;
}

interface FavoritesByGenreProps {
  favorites: StoredArtist[];
  onSelectArtist: (artist: StoredArtist) => void;
  onUpdateArtistGenre?: (artistId: string, genre: string) => void;
}

interface GenreGroup {
  genre: string;
  artists: StoredArtist[];
}

export function FavoritesByGenre({ favorites, onSelectArtist, onUpdateArtistGenre }: FavoritesByGenreProps) {
  // Use shared genre preferences hook
  const {
    genreOrder: customGenreOrder,
    emptyGenres,
    getGenreColors,
    saveGenreOrder,
    addGenre: addGenreToStorage,
    deleteEmptyGenre,
  } = useGenrePreferences();

  // All sections expanded by default
  const [collapsedGenres, setCollapsedGenres] = useState<Set<string>>(new Set());
  const [draggedGenre, setDraggedGenre] = useState<string | null>(null);
  const [draggedArtist, setDraggedArtist] = useState<StoredArtist | null>(null);
  const [dropTargetGenre, setDropTargetGenre] = useState<string | null>(null);
  const [genreDragOverIndex, setGenreDragOverIndex] = useState<number | null>(null);
  const [showAddGenre, setShowAddGenre] = useState(false);
  const [customGenreName, setCustomGenreName] = useState('');

  // Add a new genre section (wraps the hook's addGenre with UI state management)
  const addGenre = useCallback((genreName: string) => {
    const trimmedName = genreName.trim();
    if (!trimmedName) return;

    // Check if genre already exists in groups or empty genres
    const genresWithArtists = favorites.map(f => f.overrideGenre || f.genres?.[0] || 'Other');
    const allCurrentGenres = new Set([...emptyGenres, ...genresWithArtists]);

    if (allCurrentGenres.has(trimmedName)) {
      // Genre already exists
      setShowAddGenre(false);
      setCustomGenreName('');
      return;
    }

    addGenreToStorage(trimmedName, allCurrentGenres);
    setShowAddGenre(false);
    setCustomGenreName('');
  }, [emptyGenres, favorites, addGenreToStorage]);

  // Get effective genre for an artist (override takes precedence)
  const getEffectiveGenre = useCallback((artist: StoredArtist) => {
    return artist.overrideGenre || artist.genres?.[0] || 'Other';
  }, []);

  // Group favorites by primary genre (including empty genres)
  const genreGroups = useMemo<GenreGroup[]>(() => {
    const groups: Record<string, StoredArtist[]> = {};

    // First, add all empty genres (so they persist even when empty)
    for (const genre of emptyGenres) {
      groups[genre] = [];
    }

    // Then add artists to their genres
    for (const artist of favorites) {
      const primaryGenre = getEffectiveGenre(artist);
      if (!groups[primaryGenre]) {
        groups[primaryGenre] = [];
      }
      groups[primaryGenre].push(artist);

      // If this genre was in emptyGenres, remove it (it now has artists)
      // We do this after the loop
    }

    // Determine effective order: custom order first, then default order for remainder
    const effectiveOrder = customGenreOrder.length > 0 ? customGenreOrder : DEFAULT_GENRE_ORDER;

    // Sort genres by effective order
    return Object.entries(groups)
      .map(([genre, artists]) => ({ genre, artists }))
      .sort((a, b) => {
        const indexA = effectiveOrder.indexOf(a.genre);
        const indexB = effectiveOrder.indexOf(b.genre);

        // If both in order, use that
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        // Known genres before unknown
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        // Alphabetical fallback
        return a.genre.localeCompare(b.genre);
      });
  }, [favorites, customGenreOrder, emptyGenres, getEffectiveGenre]);

  // Get list of genres that are not currently shown (for the add dropdown)
  const availableGenresToAdd = useMemo(() => {
    const currentGenres = new Set(genreGroups.map(g => g.genre));
    return DEFAULT_GENRE_ORDER.filter(g => !currentGenres.has(g));
  }, [genreGroups]);

  // Toggle genre collapse
  const toggleGenre = useCallback((genre: string) => {
    setCollapsedGenres((prev) => {
      const next = new Set(prev);
      if (next.has(genre)) {
        next.delete(genre);
      } else {
        next.add(genre);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setCollapsedGenres(new Set());
  }, []);

  const collapseAll = useCallback(() => {
    setCollapsedGenres(new Set(genreGroups.map((g) => g.genre)));
  }, [genreGroups]);

  // Genre section drag handlers
  const handleGenreDragStart = useCallback((e: React.DragEvent, genre: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'genre', genre }));
    setDraggedGenre(genre);
  }, []);

  const handleGenreDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setGenreDragOverIndex(index);
  }, []);

  const handleGenreDragLeave = useCallback(() => {
    setGenreDragOverIndex(null);
  }, []);

  const handleGenreDrop = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();

    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));

      if (data.type === 'genre' && data.genre) {
        const currentOrder = genreGroups.map(g => g.genre);
        const sourceIndex = currentOrder.indexOf(data.genre);

        if (sourceIndex !== -1 && sourceIndex !== targetIndex) {
          const newOrder = [...currentOrder];
          newOrder.splice(sourceIndex, 1);
          newOrder.splice(targetIndex, 0, data.genre);
          saveGenreOrder(newOrder);
        }
      }
    } catch {
      // Ignore parse errors
    }

    setDraggedGenre(null);
    setGenreDragOverIndex(null);
  }, [genreGroups, saveGenreOrder]);

  const handleGenreDragEnd = useCallback(() => {
    setDraggedGenre(null);
    setGenreDragOverIndex(null);
  }, []);

  // Artist drag handlers
  const handleArtistDragStart = useCallback((e: React.DragEvent, artist: StoredArtist) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'artist', artistId: artist.id }));
    setDraggedArtist(artist);
  }, []);

  const handleArtistDragOver = useCallback((e: React.DragEvent, genre: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetGenre(genre);
  }, []);

  const handleArtistDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if actually leaving the section
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget || !relatedTarget.closest('[data-genre-section]')) {
      setDropTargetGenre(null);
    }
  }, []);

  const handleArtistDrop = useCallback((e: React.DragEvent, targetGenre: string) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));

      if (data.type === 'artist' && data.artistId && onUpdateArtistGenre) {
        const artist = favorites.find(f => f.id === data.artistId);
        if (artist) {
          const currentGenre = getEffectiveGenre(artist);
          if (currentGenre !== targetGenre) {
            onUpdateArtistGenre(data.artistId, targetGenre);
          }
        }
      }
    } catch {
      // Ignore parse errors
    }

    setDraggedArtist(null);
    setDropTargetGenre(null);
  }, [favorites, getEffectiveGenre, onUpdateArtistGenre]);

  const handleArtistDragEnd = useCallback(() => {
    setDraggedArtist(null);
    setDropTargetGenre(null);
  }, []);

  if (favorites.length === 0) {
    return null;
  }

  const allCollapsed = collapsedGenres.size === genreGroups.length;
  const allExpanded = collapsedGenres.size === 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-600 font-medium">Favorites</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowAddGenre(!showAddGenre)}
            className="text-xs px-1.5 py-0.5 rounded transition-colors text-blue-500 hover:text-blue-700 hover:bg-blue-50 flex items-center gap-0.5"
          >
            <Plus className="w-3 h-3" />
            Add Genre
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={expandAll}
            disabled={allExpanded}
            className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
              allExpanded ? 'text-gray-300' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            Expand All
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={collapseAll}
            disabled={allCollapsed}
            className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
              allCollapsed ? 'text-gray-300' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Add Genre Panel */}
      {showAddGenre && (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
          <p className="text-xs text-gray-600 font-medium">Add a genre section:</p>

          {/* Predefined genres */}
          {availableGenresToAdd.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {availableGenresToAdd.map((genre) => {
                const colors = GENRE_COLORS[genre] || DEFAULT_COLORS;
                return (
                  <button
                    key={genre}
                    onClick={() => addGenre(genre)}
                    className={`text-xs px-2 py-1 rounded border ${colors.border} ${colors.buttonBg} ${colors.buttonText} hover:opacity-80 transition-opacity`}
                  >
                    {genre}
                  </button>
                );
              })}
            </div>
          )}

          {/* Custom genre input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={customGenreName}
              onChange={(e) => setCustomGenreName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addGenre(customGenreName);
                }
              }}
              placeholder="Or create custom genre..."
              className="flex-1 text-xs px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:border-blue-400"
            />
            <button
              onClick={() => addGenre(customGenreName)}
              disabled={!customGenreName.trim()}
              className="text-xs px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
            <button
              onClick={() => {
                setShowAddGenre(false);
                setCustomGenreName('');
              }}
              className="text-xs px-2 py-1.5 text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {genreGroups.map(({ genre, artists }, index) => {
          const isCollapsed = collapsedGenres.has(genre);
          const isDragging = draggedGenre === genre;
          const isDragOver = genreDragOverIndex === index;
          const isArtistDropTarget = dropTargetGenre === genre && draggedArtist !== null;
          const colors = getGenreColors(genre);
          const isEmpty = artists.length === 0;
          const canDelete = isEmpty; // Can delete any empty section

          return (
            <div
              key={genre}
              data-genre-section={genre}
              draggable
              onDragStart={(e) => handleGenreDragStart(e, genre)}
              onDragOver={(e) => {
                handleGenreDragOver(e, index);
                if (draggedArtist) {
                  handleArtistDragOver(e, genre);
                }
              }}
              onDragLeave={(e) => {
                handleGenreDragLeave();
                handleArtistDragLeave(e);
              }}
              onDrop={(e) => {
                if (draggedArtist) {
                  handleArtistDrop(e, genre);
                } else {
                  handleGenreDrop(e, index);
                }
              }}
              onDragEnd={() => {
                handleGenreDragEnd();
                handleArtistDragEnd();
              }}
              className={`border rounded-lg overflow-hidden transition-all ${colors.border} ${
                isDragging ? 'opacity-50 scale-[0.98]' : ''
              } ${isDragOver && !draggedArtist ? 'border-blue-400 border-2' : ''} ${
                isArtistDropTarget ? 'border-green-400 border-2 bg-green-50' : ''
              }`}
            >
              <div
                className={`flex items-center gap-1 px-2 py-1.5 ${colors.header} hover:opacity-80 transition-colors cursor-grab active:cursor-grabbing`}
              >
                <GripVertical className={`w-3.5 h-3.5 ${colors.text} opacity-50 flex-shrink-0`} />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleGenre(genre);
                  }}
                  className="flex items-center gap-2 flex-1 text-left transition-colors"
                >
                  {isCollapsed ? (
                    <ChevronRight className={`w-3.5 h-3.5 ${colors.text} opacity-70 flex-shrink-0`} />
                  ) : (
                    <ChevronDown className={`w-3.5 h-3.5 ${colors.text} opacity-70 flex-shrink-0`} />
                  )}
                  <span className={`text-sm font-medium ${colors.text}`}>{genre}</span>
                  <span className={`text-xs ${colors.text} opacity-60`}>({artists.length})</span>
                </button>
                {canDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteEmptyGenre(genre);
                    }}
                    className={`p-1 rounded hover:bg-white/50 ${colors.text} opacity-50 hover:opacity-100 transition-opacity`}
                    title="Delete empty genre section"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {!isCollapsed && (
                <div
                  className={`px-3 py-2 flex flex-wrap gap-2 ${colors.content} min-h-[44px] transition-colors ${
                    isArtistDropTarget ? 'bg-green-50' : ''
                  }`}
                >
                  {artists.map((artist) => {
                    const isBeingDragged = draggedArtist?.id === artist.id;
                    return (
                      <Button
                        key={artist.id}
                        variant="outline"
                        size="sm"
                        draggable
                        onDragStart={(e) => handleArtistDragStart(e, artist)}
                        onDragEnd={handleArtistDragEnd}
                        onClick={() => onSelectArtist(artist)}
                        className={`text-xs ${colors.buttonBorder} ${colors.buttonBg} hover:opacity-80 ${colors.buttonText} cursor-grab active:cursor-grabbing ${
                          isBeingDragged ? 'opacity-50' : ''
                        }`}
                      >
                        <span className="mr-1">&#9733;</span>
                        {artist.name}
                      </Button>
                    );
                  })}
                  {artists.length === 0 && (
                    <span className="text-xs text-gray-400 italic">Drop artists here</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {(draggedArtist || draggedGenre) && (
        <p className="text-xs text-gray-400 text-center mt-2">
          {draggedArtist ? 'Drop on a genre section to move artist' : 'Drag to reorder genres'}
        </p>
      )}
    </div>
  );
}
