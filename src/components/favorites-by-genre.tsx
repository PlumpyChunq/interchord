'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, GripVertical, Plus, X } from 'lucide-react';

// localStorage keys
const GENRE_ORDER_KEY = 'interchord-genre-order';
const EMPTY_GENRES_KEY = 'interchord-empty-genres';
const CUSTOM_GENRE_COLORS_KEY = 'interchord-custom-genre-colors';

// Default genre category order
const DEFAULT_GENRE_ORDER = [
  'Rock',
  'Punk/Hardcore',
  'Metal',
  'Indie/Alternative',
  'Grunge',
  'New Wave',
  'Pop',
  'Jazz',
  'Electronic',
  'Hip-Hop',
  'R&B/Soul',
  'Folk/Country',
  'Blues',
  'Classical',
  'World',
  'Experimental',
  'Other',
];

// Color schemes for each genre (header bg, content bg, border, text, button bg, button border)
const GENRE_COLORS: Record<string, { header: string; content: string; border: string; text: string; buttonBg: string; buttonBorder: string; buttonText: string }> = {
  'Rock': { header: 'bg-red-50', content: 'bg-red-50/30', border: 'border-red-200', text: 'text-red-700', buttonBg: 'bg-red-50', buttonBorder: 'border-red-300', buttonText: 'text-red-700' },
  'Punk/Hardcore': { header: 'bg-rose-50', content: 'bg-rose-50/30', border: 'border-rose-200', text: 'text-rose-700', buttonBg: 'bg-rose-50', buttonBorder: 'border-rose-300', buttonText: 'text-rose-700' },
  'Metal': { header: 'bg-zinc-100', content: 'bg-zinc-100/30', border: 'border-zinc-300', text: 'text-zinc-700', buttonBg: 'bg-zinc-100', buttonBorder: 'border-zinc-400', buttonText: 'text-zinc-700' },
  'Indie/Alternative': { header: 'bg-indigo-50', content: 'bg-indigo-50/30', border: 'border-indigo-200', text: 'text-indigo-700', buttonBg: 'bg-indigo-50', buttonBorder: 'border-indigo-300', buttonText: 'text-indigo-700' },
  'Grunge': { header: 'bg-stone-100', content: 'bg-stone-100/30', border: 'border-stone-300', text: 'text-stone-700', buttonBg: 'bg-stone-100', buttonBorder: 'border-stone-400', buttonText: 'text-stone-700' },
  'New Wave': { header: 'bg-sky-50', content: 'bg-sky-50/30', border: 'border-sky-200', text: 'text-sky-700', buttonBg: 'bg-sky-50', buttonBorder: 'border-sky-300', buttonText: 'text-sky-700' },
  'Pop': { header: 'bg-pink-50', content: 'bg-pink-50/30', border: 'border-pink-200', text: 'text-pink-700', buttonBg: 'bg-pink-50', buttonBorder: 'border-pink-300', buttonText: 'text-pink-700' },
  'Jazz': { header: 'bg-purple-50', content: 'bg-purple-50/30', border: 'border-purple-200', text: 'text-purple-700', buttonBg: 'bg-purple-50', buttonBorder: 'border-purple-300', buttonText: 'text-purple-700' },
  'Electronic': { header: 'bg-cyan-50', content: 'bg-cyan-50/30', border: 'border-cyan-200', text: 'text-cyan-700', buttonBg: 'bg-cyan-50', buttonBorder: 'border-cyan-300', buttonText: 'text-cyan-700' },
  'Hip-Hop': { header: 'bg-orange-50', content: 'bg-orange-50/30', border: 'border-orange-200', text: 'text-orange-700', buttonBg: 'bg-orange-50', buttonBorder: 'border-orange-300', buttonText: 'text-orange-700' },
  'R&B/Soul': { header: 'bg-violet-50', content: 'bg-violet-50/30', border: 'border-violet-200', text: 'text-violet-700', buttonBg: 'bg-violet-50', buttonBorder: 'border-violet-300', buttonText: 'text-violet-700' },
  'Folk/Country': { header: 'bg-amber-50', content: 'bg-amber-50/30', border: 'border-amber-200', text: 'text-amber-700', buttonBg: 'bg-amber-50', buttonBorder: 'border-amber-300', buttonText: 'text-amber-700' },
  'Blues': { header: 'bg-blue-50', content: 'bg-blue-50/30', border: 'border-blue-200', text: 'text-blue-700', buttonBg: 'bg-blue-50', buttonBorder: 'border-blue-300', buttonText: 'text-blue-700' },
  'Classical': { header: 'bg-slate-50', content: 'bg-slate-50/30', border: 'border-slate-200', text: 'text-slate-700', buttonBg: 'bg-slate-50', buttonBorder: 'border-slate-300', buttonText: 'text-slate-700' },
  'World': { header: 'bg-teal-50', content: 'bg-teal-50/30', border: 'border-teal-200', text: 'text-teal-700', buttonBg: 'bg-teal-50', buttonBorder: 'border-teal-300', buttonText: 'text-teal-700' },
  'Experimental': { header: 'bg-fuchsia-50', content: 'bg-fuchsia-50/30', border: 'border-fuchsia-200', text: 'text-fuchsia-700', buttonBg: 'bg-fuchsia-50', buttonBorder: 'border-fuchsia-300', buttonText: 'text-fuchsia-700' },
  'Other': { header: 'bg-gray-50', content: 'bg-gray-50/30', border: 'border-gray-200', text: 'text-gray-700', buttonBg: 'bg-gray-50', buttonBorder: 'border-gray-300', buttonText: 'text-gray-700' },
};

// Default color for unknown genres
const DEFAULT_COLORS = { header: 'bg-gray-50', content: 'bg-gray-50/30', border: 'border-gray-200', text: 'text-gray-700', buttonBg: 'bg-gray-50', buttonBorder: 'border-gray-300', buttonText: 'text-gray-700' };

// Additional colors for custom genres (these aren't used by predefined genres)
const EXTRA_COLORS = [
  { header: 'bg-lime-50', content: 'bg-lime-50/30', border: 'border-lime-200', text: 'text-lime-700', buttonBg: 'bg-lime-50', buttonBorder: 'border-lime-300', buttonText: 'text-lime-700' },
  { header: 'bg-emerald-50', content: 'bg-emerald-50/30', border: 'border-emerald-200', text: 'text-emerald-700', buttonBg: 'bg-emerald-50', buttonBorder: 'border-emerald-300', buttonText: 'text-emerald-700' },
  { header: 'bg-sky-50', content: 'bg-sky-50/30', border: 'border-sky-200', text: 'text-sky-700', buttonBg: 'bg-sky-50', buttonBorder: 'border-sky-300', buttonText: 'text-sky-700' },
  { header: 'bg-indigo-50', content: 'bg-indigo-50/30', border: 'border-indigo-200', text: 'text-indigo-700', buttonBg: 'bg-indigo-50', buttonBorder: 'border-indigo-300', buttonText: 'text-indigo-700' },
  { header: 'bg-rose-50', content: 'bg-rose-50/30', border: 'border-rose-200', text: 'text-rose-700', buttonBg: 'bg-rose-50', buttonBorder: 'border-rose-300', buttonText: 'text-rose-700' },
  { header: 'bg-yellow-50', content: 'bg-yellow-50/30', border: 'border-yellow-200', text: 'text-yellow-700', buttonBg: 'bg-yellow-50', buttonBorder: 'border-yellow-300', buttonText: 'text-yellow-700' },
  { header: 'bg-green-50', content: 'bg-green-50/30', border: 'border-green-200', text: 'text-green-700', buttonBg: 'bg-green-50', buttonBorder: 'border-green-300', buttonText: 'text-green-700' },
  { header: 'bg-stone-100', content: 'bg-stone-100/30', border: 'border-stone-300', text: 'text-stone-700', buttonBg: 'bg-stone-100', buttonBorder: 'border-stone-300', buttonText: 'text-stone-700' },
];

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
  // All sections expanded by default
  const [collapsedGenres, setCollapsedGenres] = useState<Set<string>>(new Set());
  const [customGenreOrder, setCustomGenreOrder] = useState<string[]>([]);
  const [emptyGenres, setEmptyGenres] = useState<string[]>([]);
  const [draggedGenre, setDraggedGenre] = useState<string | null>(null);
  const [draggedArtist, setDraggedArtist] = useState<StoredArtist | null>(null);
  const [dropTargetGenre, setDropTargetGenre] = useState<string | null>(null);
  const [genreDragOverIndex, setGenreDragOverIndex] = useState<number | null>(null);
  const [showAddGenre, setShowAddGenre] = useState(false);
  const [customGenreName, setCustomGenreName] = useState('');
  const [customGenreColors, setCustomGenreColors] = useState<Record<string, number>>({});

  // Load custom genre order, empty genres, and custom colors from localStorage
  useEffect(() => {
    try {
      const storedOrder = localStorage.getItem(GENRE_ORDER_KEY);
      if (storedOrder) {
        setCustomGenreOrder(JSON.parse(storedOrder));
      }
      const storedEmpty = localStorage.getItem(EMPTY_GENRES_KEY);
      if (storedEmpty) {
        setEmptyGenres(JSON.parse(storedEmpty));
      }
      const storedColors = localStorage.getItem(CUSTOM_GENRE_COLORS_KEY);
      if (storedColors) {
        setCustomGenreColors(JSON.parse(storedColors));
      }
    } catch {
      // Ignore
    }
  }, []);

  // Save custom genre order to localStorage
  const saveGenreOrder = useCallback((order: string[]) => {
    setCustomGenreOrder(order);
    try {
      localStorage.setItem(GENRE_ORDER_KEY, JSON.stringify(order));
    } catch {
      // Ignore
    }
  }, []);

  // Save empty genres to localStorage
  const saveEmptyGenres = useCallback((genres: string[]) => {
    setEmptyGenres(genres);
    try {
      localStorage.setItem(EMPTY_GENRES_KEY, JSON.stringify(genres));
    } catch {
      // Ignore
    }
  }, []);

  // Save custom genre colors to localStorage
  const saveCustomGenreColors = useCallback((colors: Record<string, number>) => {
    setCustomGenreColors(colors);
    try {
      localStorage.setItem(CUSTOM_GENRE_COLORS_KEY, JSON.stringify(colors));
    } catch {
      // Ignore
    }
  }, []);

  // Get a random color index that's not already used
  const getRandomColorIndex = useCallback(() => {
    const usedIndices = new Set(Object.values(customGenreColors));
    const availableIndices = EXTRA_COLORS.map((_, i) => i).filter(i => !usedIndices.has(i));
    if (availableIndices.length === 0) {
      // All colors used, pick any random one
      return Math.floor(Math.random() * EXTRA_COLORS.length);
    }
    return availableIndices[Math.floor(Math.random() * availableIndices.length)];
  }, [customGenreColors]);

  // Get color for a genre (predefined or custom)
  const getGenreColors = useCallback((genre: string) => {
    // Check predefined colors first
    if (GENRE_COLORS[genre]) {
      return GENRE_COLORS[genre];
    }
    // Check custom colors
    if (customGenreColors[genre] !== undefined) {
      return EXTRA_COLORS[customGenreColors[genre]] || DEFAULT_COLORS;
    }
    return DEFAULT_COLORS;
  }, [customGenreColors]);

  // Add a new genre section
  const addGenre = useCallback((genreName: string) => {
    const trimmedName = genreName.trim();
    if (!trimmedName) return;

    // Check if genre already exists in groups or empty genres
    const existingGenres = [...emptyGenres];
    const genresWithArtists = favorites.map(f => f.overrideGenre || f.genres?.[0] || 'Other');
    const allCurrentGenres = new Set([...existingGenres, ...genresWithArtists]);

    if (allCurrentGenres.has(trimmedName)) {
      // Genre already exists
      setShowAddGenre(false);
      setCustomGenreName('');
      return;
    }

    // Add to empty genres
    const newEmptyGenres = [...emptyGenres, trimmedName];
    saveEmptyGenres(newEmptyGenres);

    // Add to genre order if not already there
    if (!customGenreOrder.includes(trimmedName)) {
      const newOrder = [...customGenreOrder, trimmedName];
      saveGenreOrder(newOrder);
    }

    // Assign a random color if this is a custom genre (not predefined)
    if (!GENRE_COLORS[trimmedName]) {
      const colorIndex = getRandomColorIndex();
      const newColors = { ...customGenreColors, [trimmedName]: colorIndex };
      saveCustomGenreColors(newColors);
    }

    setShowAddGenre(false);
    setCustomGenreName('');
  }, [emptyGenres, favorites, customGenreOrder, customGenreColors, saveEmptyGenres, saveGenreOrder, saveCustomGenreColors, getRandomColorIndex]);

  // Delete an empty genre section
  const deleteEmptyGenre = useCallback((genreName: string) => {
    // Remove from empty genres
    const newEmptyGenres = emptyGenres.filter(g => g !== genreName);
    saveEmptyGenres(newEmptyGenres);

    // Also remove from custom order
    const newOrder = customGenreOrder.filter(g => g !== genreName);
    saveGenreOrder(newOrder);

    // Remove custom color if it exists
    if (customGenreColors[genreName] !== undefined) {
      const newColors = { ...customGenreColors };
      delete newColors[genreName];
      saveCustomGenreColors(newColors);
    }
  }, [emptyGenres, customGenreOrder, customGenreColors, saveEmptyGenres, saveGenreOrder, saveCustomGenreColors]);

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
