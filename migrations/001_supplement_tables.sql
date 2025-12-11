-- Migration: 001_supplement_tables
-- Description: Create tables for Wikipedia-derived supplementary artist data
-- Target database: interchord_db (port 5433)

-- Table 1: Band/artist supplementary metadata
CREATE TABLE IF NOT EXISTS artist_supplement (
    mbid UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    wikipedia_title VARCHAR(255),
    formation_year INTEGER,
    formation_city VARCHAR(255),
    formation_country VARCHAR(255),
    wikipedia_extract TEXT,
    parsed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table 2: Founding members extracted from Wikipedia
CREATE TABLE IF NOT EXISTS founding_member (
    id SERIAL PRIMARY KEY,
    band_mbid UUID NOT NULL REFERENCES artist_supplement(mbid) ON DELETE CASCADE,
    member_name VARCHAR(255) NOT NULL,
    member_mbid UUID,                    -- Matched MusicBrainz ID (null if unmatched)
    instruments TEXT[],                  -- Instruments mentioned in Wikipedia
    confidence FLOAT DEFAULT 0.0,        -- Match confidence (0.0 - 1.0)
    match_method VARCHAR(50),            -- 'exact', 'fuzzy', 'unmatched'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(band_mbid, member_name)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_founding_member_band ON founding_member(band_mbid);
CREATE INDEX IF NOT EXISTS idx_founding_member_mbid ON founding_member(member_mbid) WHERE member_mbid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_artist_supplement_parsed ON artist_supplement(parsed_at);

-- Comment on tables
COMMENT ON TABLE artist_supplement IS 'Supplementary artist data parsed from Wikipedia to fill MusicBrainz gaps';
COMMENT ON TABLE founding_member IS 'Founding members extracted from Wikipedia article intros';
COMMENT ON COLUMN founding_member.confidence IS 'How confident the name match is: 1.0 = exact match, 0.8+ = fuzzy match';
COMMENT ON COLUMN founding_member.match_method IS 'How the name was matched: exact, fuzzy, or unmatched';
