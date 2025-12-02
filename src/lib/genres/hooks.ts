'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  STORAGE_KEYS,
  getStorageItem,
  setStorageItem,
} from '@/lib/storage';

// Default genre category order
export const DEFAULT_GENRE_ORDER = [
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

// Color schemes for each genre
export interface GenreColorScheme {
  header: string;
  content: string;
  border: string;
  text: string;
  buttonBg: string;
  buttonBorder: string;
  buttonText: string;
}

export const GENRE_COLORS: Record<string, GenreColorScheme> = {
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
export const DEFAULT_COLORS: GenreColorScheme = {
  header: 'bg-gray-50',
  content: 'bg-gray-50/30',
  border: 'border-gray-200',
  text: 'text-gray-700',
  buttonBg: 'bg-gray-50',
  buttonBorder: 'border-gray-300',
  buttonText: 'text-gray-700',
};

// Additional colors for custom genres
export const EXTRA_COLORS: GenreColorScheme[] = [
  { header: 'bg-lime-50', content: 'bg-lime-50/30', border: 'border-lime-200', text: 'text-lime-700', buttonBg: 'bg-lime-50', buttonBorder: 'border-lime-300', buttonText: 'text-lime-700' },
  { header: 'bg-emerald-50', content: 'bg-emerald-50/30', border: 'border-emerald-200', text: 'text-emerald-700', buttonBg: 'bg-emerald-50', buttonBorder: 'border-emerald-300', buttonText: 'text-emerald-700' },
  { header: 'bg-sky-50', content: 'bg-sky-50/30', border: 'border-sky-200', text: 'text-sky-700', buttonBg: 'bg-sky-50', buttonBorder: 'border-sky-300', buttonText: 'text-sky-700' },
  { header: 'bg-indigo-50', content: 'bg-indigo-50/30', border: 'border-indigo-200', text: 'text-indigo-700', buttonBg: 'bg-indigo-50', buttonBorder: 'border-indigo-300', buttonText: 'text-indigo-700' },
  { header: 'bg-rose-50', content: 'bg-rose-50/30', border: 'border-rose-200', text: 'text-rose-700', buttonBg: 'bg-rose-50', buttonBorder: 'border-rose-300', buttonText: 'text-rose-700' },
  { header: 'bg-yellow-50', content: 'bg-yellow-50/30', border: 'border-yellow-200', text: 'text-yellow-700', buttonBg: 'bg-yellow-50', buttonBorder: 'border-yellow-300', buttonText: 'text-yellow-700' },
  { header: 'bg-green-50', content: 'bg-green-50/30', border: 'border-green-200', text: 'text-green-700', buttonBg: 'bg-green-50', buttonBorder: 'border-green-300', buttonText: 'text-green-700' },
  { header: 'bg-stone-100', content: 'bg-stone-100/30', border: 'border-stone-300', text: 'text-stone-700', buttonBg: 'bg-stone-100', buttonBorder: 'border-stone-300', buttonText: 'text-stone-700' },
];

interface UseGenrePreferencesResult {
  genreOrder: string[];
  emptyGenres: string[];
  customGenreColors: Record<string, number>;
  saveGenreOrder: (order: string[]) => void;
  saveEmptyGenres: (genres: string[]) => void;
  saveCustomGenreColors: (colors: Record<string, number>) => void;
  getGenreColors: (genre: string) => GenreColorScheme;
  getRandomColorIndex: () => number;
  addGenre: (genreName: string, existingGenres: Set<string>) => void;
  deleteEmptyGenre: (genreName: string) => void;
}

/**
 * Hook to manage genre preferences (order, empty genres, custom colors)
 */
export function useGenrePreferences(): UseGenrePreferencesResult {
  const [genreOrder, setGenreOrder] = useState<string[]>([]);
  const [emptyGenres, setEmptyGenres] = useState<string[]>([]);
  const [customGenreColors, setCustomGenreColors] = useState<Record<string, number>>({});

  // Load preferences from localStorage
  useEffect(() => {
    const storedOrder = getStorageItem<string[]>(STORAGE_KEYS.GENRE_ORDER, []);
    if (storedOrder) setGenreOrder(storedOrder);

    const storedEmpty = getStorageItem<string[]>(STORAGE_KEYS.EMPTY_GENRES, []);
    if (storedEmpty) setEmptyGenres(storedEmpty);

    const storedColors = getStorageItem<Record<string, number>>(STORAGE_KEYS.CUSTOM_GENRE_COLORS, {});
    if (storedColors) setCustomGenreColors(storedColors);
  }, []);

  const saveGenreOrder = useCallback((order: string[]) => {
    setGenreOrder(order);
    setStorageItem(STORAGE_KEYS.GENRE_ORDER, order);
  }, []);

  const saveEmptyGenres = useCallback((genres: string[]) => {
    setEmptyGenres(genres);
    setStorageItem(STORAGE_KEYS.EMPTY_GENRES, genres);
  }, []);

  const saveCustomGenreColors = useCallback((colors: Record<string, number>) => {
    setCustomGenreColors(colors);
    setStorageItem(STORAGE_KEYS.CUSTOM_GENRE_COLORS, colors);
  }, []);

  const getGenreColors = useCallback((genre: string): GenreColorScheme => {
    if (GENRE_COLORS[genre]) {
      return GENRE_COLORS[genre];
    }
    if (customGenreColors[genre] !== undefined) {
      return EXTRA_COLORS[customGenreColors[genre]] || DEFAULT_COLORS;
    }
    return DEFAULT_COLORS;
  }, [customGenreColors]);

  const getRandomColorIndex = useCallback(() => {
    const usedIndices = new Set(Object.values(customGenreColors));
    const availableIndices = EXTRA_COLORS.map((_, i) => i).filter(i => !usedIndices.has(i));
    if (availableIndices.length === 0) {
      return Math.floor(Math.random() * EXTRA_COLORS.length);
    }
    return availableIndices[Math.floor(Math.random() * availableIndices.length)];
  }, [customGenreColors]);

  const addGenre = useCallback((genreName: string, existingGenres: Set<string>) => {
    const trimmedName = genreName.trim();
    if (!trimmedName || existingGenres.has(trimmedName)) return;

    const newEmptyGenres = [...emptyGenres, trimmedName];
    saveEmptyGenres(newEmptyGenres);

    if (!genreOrder.includes(trimmedName)) {
      const newOrder = [...genreOrder, trimmedName];
      saveGenreOrder(newOrder);
    }

    if (!GENRE_COLORS[trimmedName]) {
      const colorIndex = getRandomColorIndex();
      const newColors = { ...customGenreColors, [trimmedName]: colorIndex };
      saveCustomGenreColors(newColors);
    }
  }, [emptyGenres, genreOrder, customGenreColors, saveEmptyGenres, saveGenreOrder, saveCustomGenreColors, getRandomColorIndex]);

  const deleteEmptyGenre = useCallback((genreName: string) => {
    const newEmptyGenres = emptyGenres.filter(g => g !== genreName);
    saveEmptyGenres(newEmptyGenres);

    const newOrder = genreOrder.filter(g => g !== genreName);
    saveGenreOrder(newOrder);

    if (customGenreColors[genreName] !== undefined) {
      const newColors = { ...customGenreColors };
      delete newColors[genreName];
      saveCustomGenreColors(newColors);
    }
  }, [emptyGenres, genreOrder, customGenreColors, saveEmptyGenres, saveGenreOrder, saveCustomGenreColors]);

  return {
    genreOrder,
    emptyGenres,
    customGenreColors,
    saveGenreOrder,
    saveEmptyGenres,
    saveCustomGenreColors,
    getGenreColors,
    getRandomColorIndex,
    addGenre,
    deleteEmptyGenre,
  };
}
