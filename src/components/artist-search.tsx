'use client';

import { useState, useCallback } from 'react';
import { useArtistSearch } from '@/lib/musicbrainz/hooks';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ArtistNode } from '@/types';

interface ArtistSearchProps {
  onSelectArtist: (artist: ArtistNode) => void;
}

export function ArtistSearch({ onSelectArtist }: ArtistSearchProps) {
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: results, isLoading, error } = useArtistSearch(searchQuery);

  const handleSearch = useCallback(() => {
    if (inputValue.trim().length >= 2) {
      setSearchQuery(inputValue.trim());
    }
  }, [inputValue]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="Search for an artist (e.g., Butthole Surfers)"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
        />
        <Button onClick={handleSearch} disabled={inputValue.length < 2 || isLoading}>
          {isLoading ? 'Searching...' : 'Search'}
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          Error: {error.message}
        </div>
      )}

      {results && results.length === 0 && searchQuery && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-gray-600">
          No artists found for &quot;{searchQuery}&quot;
        </div>
      )}

      {results && results.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">
            Found {results.length} result{results.length !== 1 ? 's' : ''} for &quot;{searchQuery}&quot;
          </p>
          <div className="grid gap-2">
            {results.map((artist) => (
              <Card
                key={artist.id}
                className="cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => onSelectArtist(artist)}
              >
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{artist.name}</CardTitle>
                      {artist.disambiguation && (
                        <CardDescription>{artist.disambiguation}</CardDescription>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                        {artist.type}
                      </span>
                      {artist.country && (
                        <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                          {artist.country}
                        </span>
                      )}
                    </div>
                  </div>
                  {artist.activeYears?.begin && (
                    <p className="text-xs text-gray-400 mt-1">
                      {artist.activeYears.begin}
                      {artist.activeYears.end ? ` – ${artist.activeYears.end}` : ' – present'}
                    </p>
                  )}
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
