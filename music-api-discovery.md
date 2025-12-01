# Music Data APIs: Complete Integration Guide

A comprehensive reference for building music discovery and artist relationship applications using Apple Music, MusicBrainz, Discogs, Last.fm, Spotify, and Wikidata APIs.

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Which API for What](#which-api-for-what)
3. [Apple Music Integration](#1-apple-music-integration)
   - Server-side API
   - MusicKit JS (Web)
   - MusicKit (iOS/macOS)
4. [MusicBrainz API](#2-musicbrainz-api)
5. [Discogs API](#3-discogs-api)
6. [Last.fm API](#4-lastfm-api)
7. [Spotify Web API](#5-spotify-web-api)
8. [Wikidata & Wikipedia](#6-wikidata-and-wikipedia-apis)
9. [Integration Patterns](#7-integration-patterns)
   - Identifier Resolution
   - Caching Strategy
   - Rate Limit Orchestration
   - Error Handling
   - TypeScript Types
10. [Appendix: Complete Type Definitions](#appendix-typescript-type-definitions)

---

## Quick Reference

### API Rate Limits at a Glance

| API | Rate Limit | Auth Required | Best For |
|-----|------------|---------------|----------|
| **Apple Music** | ~20 req/sec | JWT + User Token | User library, playback, playlists |
| **MusicBrainz** | **1 req/sec** (strict) | User-Agent only | Artist relationships, band members |
| **Discogs** | 60 req/min (auth) | Token | Discography, label info, aliases |
| **Last.fm** | ~5 req/sec | API key | Similar artists, play counts, tags |
| **Spotify** | Variable | OAuth | Related artists, audio features |
| **Wikidata** | ~500 req/hr | User-Agent | ID crosswalk, structured data |

### Cost Summary

| Service | Cost | Notes |
|---------|------|-------|
| Apple Developer Program | $99/year | Required for MusicKit |
| MusicBrainz | Free | Consider donation for heavy use |
| Discogs | Free | Token via account settings |
| Last.fm | Free | Register for API key |
| Spotify | Free | Developer dashboard registration |
| Wikidata | Free | No registration needed |

---

## Which API for What

Use this decision matrix to choose the right data source:

| Need | Primary Source | Fallback | Notes |
|------|---------------|----------|-------|
| **Band membership** | MusicBrainz | Discogs | MB has temporal data (start/end dates) |
| **Side projects** | MusicBrainz | Discogs `groups` | MB relationship types are richer |
| **Collaborations** | MusicBrainz | Spotify | MB has credited roles |
| **Similar artists** | Last.fm | Spotify | Last.fm has match scores (0-1) |
| **Related artists** | Spotify | Last.fm | Spotify's algorithm differs from similarity |
| **Play counts** | Last.fm | — | Apple Music doesn't expose this |
| **Audio features** | Spotify | — | Tempo, energy, danceability, etc. |
| **Artist biography** | Wikipedia | Last.fm | Wikipedia is more comprehensive |
| **Genre/tags** | Last.fm | MusicBrainz | User-generated vs. curated |
| **Discography** | Discogs | MusicBrainz | Discogs has format/pressing details |
| **Label info** | Discogs | MusicBrainz | Discogs is more complete |
| **ID crosswalk** | Wikidata | MusicBrainz URL-rels | Wikidata is the canonical source |
| **User library** | Apple Music | — | Only source for Apple Music data |
| **Playback** | Apple Music | Spotify | Depends on user's subscription |

---

## 1. Apple Music Integration

Apple Music provides three integration paths: server-side REST API, client-side MusicKit JS, and native MusicKit framework.

### Prerequisites

- **Apple Developer Program membership** ($99 USD/year)
- MusicKit capability enabled on your App ID
- Private key (.p8 file) for JWT generation

### 1.1 Server-Side API

**Base URL:** `https://api.music.apple.com/v1/`

#### Authentication

Two tokens are required:

| Token | Purpose | Lifetime | Generation |
|-------|---------|----------|------------|
| Developer Token | App authentication | 180 days max | Server-side JWT |
| Music User Token | User authorization | ~6 months | Client-side MusicKit |

**Developer Token (JWT) generation:**

```typescript
import jwt from 'jsonwebtoken';
import fs from 'fs';

interface AppleMusicJWTPayload {
  iss: string;
  iat: number;
  exp: number;
}

function generateDeveloperToken(): string {
  const privateKey = fs.readFileSync('AuthKey_XXXXXXXXXX.p8');

  const payload: AppleMusicJWTPayload = {
    iss: process.env.APPLE_TEAM_ID!,      // 10-char Team ID
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (180 * 24 * 60 * 60), // 180 days
  };

  return jwt.sign(payload, privateKey, {
    algorithm: 'ES256',
    header: {
      alg: 'ES256',
      kid: process.env.APPLE_KEY_ID!,     // 10-char Key ID
    },
  });
}
```

#### Request Headers

```typescript
const headers = {
  'Authorization': `Bearer ${developerToken}`,
  'Music-User-Token': userToken,  // Only for /v1/me/* endpoints
};
```

#### Key Endpoints

**User Library (requires Music User Token):**

| Endpoint | Description |
|----------|-------------|
| `GET /v1/me/library/songs` | All library songs |
| `GET /v1/me/library/albums` | All library albums |
| `GET /v1/me/library/artists` | All library artists |
| `GET /v1/me/library/playlists` | All library playlists |
| `GET /v1/me/recent/played/tracks` | Recently played tracks |
| `GET /v1/me/history/heavy-rotation` | Frequently played content |
| `GET /v1/me/recommendations` | Personalized recommendations |
| `POST /v1/me/library/playlists` | Create playlist |
| `POST /v1/me/library/playlists/{id}/tracks` | Add tracks to playlist |

**Catalog (Developer Token only):**

| Endpoint | Description |
|----------|-------------|
| `GET /v1/catalog/{storefront}/search` | Search catalog |
| `GET /v1/catalog/{storefront}/artists/{id}` | Artist details |
| `GET /v1/catalog/{storefront}/artists/{id}/albums` | Artist's albums |
| `GET /v1/catalog/{storefront}/albums/{id}` | Album details |

**Storefront codes:** `us`, `gb`, `jp`, `de`, etc. Use user's locale or default to `us`.

#### Example: Search Artists

```typescript
async function searchAppleMusicArtists(
  query: string,
  developerToken: string,
  storefront = 'us'
): Promise<AppleMusicArtist[]> {
  const url = new URL(`https://api.music.apple.com/v1/catalog/${storefront}/search`);
  url.searchParams.set('term', query);
  url.searchParams.set('types', 'artists');
  url.searchParams.set('limit', '10');

  const response = await fetch(url.toString(), {
    headers: { 'Authorization': `Bearer ${developerToken}` },
  });

  if (!response.ok) {
    throw new AppleMusicError('Search failed', response.status);
  }

  const data = await response.json();
  return data.results?.artists?.data ?? [];
}
```

#### Limitations

- **No play counts** - Cannot determine user's most played tracks
- **No similar artists endpoint** - Must use Last.fm or Spotify
- **No artist relationships** - Must use MusicBrainz
- **User token expiry** - ~6 months, no refresh mechanism

### 1.2 MusicKit JS (Web)

**CDN:** `https://js-cdn.music.apple.com/musickit/v3/musickit.js`

```typescript
// Initialize MusicKit
document.addEventListener('musickitloaded', async () => {
  await MusicKit.configure({
    developerToken: await fetchDeveloperToken(), // From your server
    app: { name: 'InterChord', build: '1.0.0' },
  });
});

// Authorization
const music = MusicKit.getInstance();
const userToken = await music.authorize(); // Opens Apple ID sign-in

// Library access
const recentlyPlayed = await music.api.recentPlayed({ limit: 25 });
const library = await music.api.library.songs({ limit: 100 });

// Playback
await music.setQueue({ song: '1440850967' });
await music.play();
```

**Browser requirements:**
- HTTPS required (localhost exempt)
- User interaction required before first playback
- Supported: Safari, Chrome, Firefox, Edge

### 1.3 MusicKit (iOS/macOS)

```swift
import MusicKit

// Request authorization
let status = await MusicAuthorization.request()
guard status == .authorized else { return }

// Search catalog
var request = MusicCatalogSearchRequest(term: "Radiohead", types: [Artist.self])
let response = try await request.response()

// Playback
let player = ApplicationMusicPlayer.shared
player.queue = [song]
try await player.play()
```

---

## 2. MusicBrainz API

MusicBrainz provides the most comprehensive **artist relationship data** available—band memberships, collaborations, side projects, and temporal metadata.

**Base URL:** `https://musicbrainz.org/ws/2/`

### Authentication

No API key required. **User-Agent header is mandatory:**

```typescript
const headers = {
  'User-Agent': 'InterChord/1.0.0 (contact@example.com)',
  'Accept': 'application/json',
};
```

### Rate Limiting (Critical)

**1 request per second average.** This is strictly enforced.

| Violation | Consequence |
|-----------|-------------|
| Burst > 1 req/sec | HTTP 503 for ALL subsequent requests |
| Continued abuse | IP temporarily banned |

**Implementation:**

```typescript
class MusicBrainzClient {
  private lastRequest = 0;
  private readonly minDelay = 1100; // 1.1 seconds for safety margin

  async request<T>(path: string): Promise<T> {
    const now = Date.now();
    const wait = Math.max(0, this.minDelay - (now - this.lastRequest));

    if (wait > 0) {
      await new Promise(resolve => setTimeout(resolve, wait));
    }

    this.lastRequest = Date.now();

    const response = await fetch(`https://musicbrainz.org/ws/2/${path}&fmt=json`, {
      headers: this.headers,
    });

    if (response.status === 503) {
      throw new RateLimitError('MusicBrainz rate limit exceeded', 60000);
    }

    return response.json();
  }
}
```

### Artist Relationships

The core value of MusicBrainz for this project. MusicBrainz has **three categories** of artist relationships we can leverage:

#### 1. Artist-to-Artist Relationships

**Query:**
```
GET /ws/2/artist/{MBID}?inc=artist-rels+url-rels&fmt=json
```

| Type | Description | Discovery Use |
|------|-------------|---------------|
| `member of band` | Person is/was member of group | Band member graphs |
| `founder` | Person founded a group | Founding member badges |
| `subgroup` | Band spawned from another band | Side project discovery |
| `supporting musician` | Long-term instrumental/vocal support | Extended network |
| `collaboration` | Short-term project between artists | Collaboration chains |
| `teacher` | Teacher/student relationship | Influence mapping |
| `tribute` | Tribute band to another artist | Fan connections |
| `artistic director` | Person was artistic director of group | Leadership roles |
| `conductor position` | Person was conductor for group | Classical music roles |

#### 2. Artist-to-Recording Relationships (Guest Appearances!)

**Query:**
```
GET /ws/2/artist/{MBID}?inc=recording-rels&fmt=json
```

| Type | Description | Discovery Use |
|------|-------------|---------------|
| `performer` | Artist performed on recording | **Guest appearances!** |
| `vocal` | Artist performed vocals | Featured vocalists |
| `instrument` | Artist played specific instrument | Session musicians |
| `producer` | Produced the recording | Producer networks |
| `remixer` | Remixed the recording | Remix connections |
| `samples from artist` | Recording samples another artist | **Sample genealogy!** |
| `engineer` | Engineering credits | Behind-the-scenes |
| `arranger` | Arranged the recording | Arrangement credits |

#### 3. Artist-to-Label Relationships (Labelmates!)

**Query:**
```
GET /ws/2/artist/{MBID}?inc=label-rels&fmt=json
```

| Type | Description | Discovery Use |
|------|-------------|---------------|
| `recording contract` | Artist signed to label | **Labelmate discovery!** |
| `label founder` | Artist founded the label | Industry connections |
| `owner` | Artist owns the label | Business relationships |
| `personal label` | Artist's vanity label | Artist-owned labels |

#### Response Structure

```json
{
  "id": "a74b1b7f-71a5-4011-9441-d0b5e4122711",
  "name": "Radiohead",
  "relations": [{
    "type": "member of band",
    "type-id": "5be4c609-9afa-4ea0-910b-12ffb71e3821",
    "direction": "backward",
    "begin": "1985",
    "end": null,
    "ended": false,
    "attributes": ["lead vocals", "guitar"],
    "artist": {
      "id": "8ed2e0b3-aa4c-4e13-bec3-dc7393ed4d6b",
      "name": "Thom Yorke"
    }
  }]
}
```

**Understanding `direction`:**
- `forward`: Queried artist is the source ("Thom Yorke is member of Radiohead")
- `backward`: Queried artist is the target ("Radiohead has member Thom Yorke")

### Combining Relationship Types

To get ALL relationships in one query (costs 1 rate-limited request):
```
GET /ws/2/artist/{MBID}?inc=artist-rels+recording-rels+label-rels+url-rels&fmt=json
```

### Disambiguation

Multiple artists may share a name. MusicBrainz provides `disambiguation` fields:

```json
{
  "artists": [
    { "name": "Nirvana", "disambiguation": "90s US grunge band" },
    { "name": "Nirvana", "disambiguation": "60s UK psychedelic band" }
  ]
}
```

**Best practice:** When searching, present disambiguation to users or use additional context (genre, active years) to auto-select.

### Entity Redirects

MusicBrainz IDs are permanent. When entities merge, the old ID redirects:

```typescript
// Handle redirects
const response = await fetch(url, { redirect: 'follow' });
const finalMBID = new URL(response.url).pathname.split('/').pop();
```

### Database Mirror Option (Eliminates Rate Limiting!)

For production use or heavy querying, you can run a **full MusicBrainz database mirror** locally. This eliminates the 1 req/sec rate limit entirely.

#### VM Requirements

| Resource | With Search | Without Search | Notes |
|----------|-------------|----------------|-------|
| **CPU** | 16 threads | 2 threads | x86-64 architecture |
| **RAM** | 16 GB | 4 GB | More = better query performance |
| **Disk** | 350 GB SSD | 100 GB SSD | SSD strongly recommended |
| **OS** | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS | Linux required (no Windows) |

#### Software Stack
- Docker Compose 2+
- PostgreSQL 16 (via Docker)
- Solr 4.1.0 (for search indexes, optional)

#### Quick Setup (Docker)

```bash
# Clone the official Docker setup
git clone https://github.com/metabrainz/musicbrainz-docker.git
cd musicbrainz-docker

# Build images
docker compose build

# Import database (~4-6 hours for initial load)
docker compose run --rm musicbrainz createdb.sh -fetch

# Start services
docker compose up -d

# Optional: Build search indexes (+60GB, several hours)
docker compose run --rm indexer
```

#### Data Licensing

| Data Type | License | Commercial Use |
|-----------|---------|----------------|
| Core data (artists, releases, recordings) | CC0 (Public Domain) | ✅ Free |
| Derived data (tags, ratings, annotations) | CC BY-NC-SA 3.0 | ❌ Non-commercial only |
| Edit history | CC BY-NC-SA 3.0 | ❌ Non-commercial only |

#### Benefits of Local Mirror

- **No rate limits** - instant queries
- **Full relationship data** - all entity types including recording-level
- **Offline capability** - works without internet
- **Custom queries** - direct SQL access for complex discovery algorithms
- **Live replication** - stay in sync with hourly updates

#### Key Tables for Artist Discovery

```sql
-- Artists (persons and groups)
SELECT * FROM artist WHERE name = 'Radiohead';

-- Artist-to-Artist relationships
SELECT a2.name, lt.name as relationship
FROM l_artist_artist laa
JOIN link l ON laa.link = l.id
JOIN link_type lt ON l.link_type = lt.id
JOIN artist a1 ON laa.entity0 = a1.id
JOIN artist a2 ON laa.entity1 = a2.id
WHERE a1.name = 'Radiohead';

-- Artist-to-Recording relationships (guest appearances!)
SELECT r.name as recording, lt.name as relationship
FROM l_artist_recording lar
JOIN link l ON lar.link = l.id
JOIN link_type lt ON l.link_type = lt.id
JOIN artist a ON lar.entity0 = a.id
JOIN recording r ON lar.entity1 = r.id
WHERE a.name = 'Thom Yorke' AND lt.name = 'performer';
```

---

## 3. Discogs API

Discogs excels at **discography data, label information, and artist aliases** with rich format and pressing details.

**Base URL:** `https://api.discogs.com/`

### Authentication

```typescript
const headers = {
  'Authorization': `Discogs token=${process.env.DISCOGS_TOKEN}`,
  'User-Agent': 'InterChord/1.0.0',
};
```

Get a token at: https://www.discogs.com/settings/developers

### Rate Limits

| Auth Status | Limit | Headers |
|-------------|-------|---------|
| Authenticated | 60 req/min | `X-Discogs-Ratelimit-Remaining` |
| Unauthenticated | 25 req/min | Same headers |

### Key Endpoints

**Artist:**
```
GET /artists/{id}
```

Response includes:
- `members[]` - Band members with `active` boolean
- `groups[]` - Groups this artist belongs to
- `aliases[]` - Alternative names/projects
- `namevariations[]` - Spelling variations

**Artist releases:**
```
GET /artists/{id}/releases?sort=year&page=1&per_page=50
```

### Master vs Release

Discogs distinguishes:
- **Master Release:** The abstract "work" (e.g., "OK Computer")
- **Release:** A specific pressing (e.g., "OK Computer UK CD 1997")

For artist mapping, use Master Releases. For discography details, use Releases.

---

## 4. Last.fm API

Last.fm provides **similarity scores and listening statistics** based on collaborative filtering of millions of users.

**Base URL:** `https://ws.audioscrobbler.com/2.0/`

### Authentication

Read-only operations need only an API key:

```typescript
const params = new URLSearchParams({
  method: 'artist.getSimilar',
  artist: 'Radiohead',
  api_key: process.env.LASTFM_API_KEY!,
  format: 'json',
  limit: '20',
});

const response = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`);
```

Register for API key: https://www.last.fm/api/account/create

### Key Endpoints

| Method | Purpose | Key Fields |
|--------|---------|------------|
| `artist.getSimilar` | Similar artists | `match` (0-1 similarity score) |
| `artist.getInfo` | Artist details | Bio, tags, stats, listeners |
| `artist.getTopTags` | Genre tags | User-generated tags with counts |
| `artist.getTopTracks` | Popular tracks | Play counts |
| `user.getTopArtists` | User's top artists | Requires user auth |

### Similarity Scores

```json
{
  "similarartists": {
    "artist": [{
      "name": "Thom Yorke",
      "match": "0.87",
      "mbid": "8ed2e0b3-aa4c-4e13-bec3-dc7393ed4d6b"
    }]
  }
}
```

The `match` field (0-1) indicates similarity strength. Values > 0.5 are strongly related.

### Rate Limits

No published limit, but:
- Implement 200-500ms delays between requests
- Error code `29` indicates rate limiting
- Aggressive abuse leads to key suspension

---

## 5. Spotify Web API

Spotify provides **related artists and audio features** that complement other data sources.

**Base URL:** `https://api.spotify.com/v1/`

### Authentication

Spotify uses OAuth 2.0. For server-to-server (no user data):

```typescript
async function getSpotifyToken(): Promise<string> {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
      ).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json();
  return data.access_token; // Valid for 1 hour
}
```

Register at: https://developer.spotify.com/dashboard

### Key Endpoints

**Related Artists:**
```
GET /v1/artists/{id}/related-artists
```

Returns up to 20 related artists based on Spotify's algorithm.

**Audio Features:**
```
GET /v1/audio-features/{track_id}
```

| Feature | Range | Description |
|---------|-------|-------------|
| `tempo` | 0-250 | BPM |
| `energy` | 0-1 | Intensity and activity |
| `danceability` | 0-1 | How suitable for dancing |
| `valence` | 0-1 | Musical positiveness |
| `acousticness` | 0-1 | Acoustic vs electronic |
| `instrumentalness` | 0-1 | Vocal presence |

**Recommendations:**
```
GET /v1/recommendations?seed_artists={ids}&limit=20
```

### Rate Limits

Spotify's limits are dynamic and not publicly documented. Monitor `Retry-After` headers:

```typescript
if (response.status === 429) {
  const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
  await new Promise(r => setTimeout(r, retryAfter * 1000));
}
```

---

## 6. Wikidata and Wikipedia APIs

Wikidata is the **universal identifier crosswalk** linking all music databases.

### Wikidata SPARQL

**Endpoint:** `https://query.wikidata.org/sparql`

**Get all external IDs for an artist:**

```sparql
SELECT ?mbid ?discogs ?spotify ?appleMusic WHERE {
  ?item rdfs:label "Radiohead"@en ;
        wdt:P31/wdt:P279* wd:Q215380 .  # instance of band
  OPTIONAL { ?item wdt:P434 ?mbid }       # MusicBrainz
  OPTIONAL { ?item wdt:P1953 ?discogs }   # Discogs
  OPTIONAL { ?item wdt:P1902 ?spotify }   # Spotify
  OPTIONAL { ?item wdt:P2850 ?appleMusic } # Apple Music
}
LIMIT 1
```

**Key properties:**

| Property | Database |
|----------|----------|
| P434 | MusicBrainz artist ID |
| P1953 | Discogs artist ID |
| P1902 | Spotify artist ID |
| P2850 | Apple Music artist ID |
| P527 | "has part" (band → members) |
| P463 | "member of" (person → bands) |

### Wikipedia REST API

**Get artist summary:**
```
GET https://en.wikipedia.org/api/rest_v1/page/summary/{title}
```

---

## 7. Integration Patterns

### Identifier Resolution

Use Wikidata as the canonical crosswalk:

```typescript
async function resolveArtistIdentifiers(artistName: string): Promise<ArtistIdentifiers> {
  // 1. Query Wikidata
  const sparql = `
    SELECT ?item ?mbid ?discogs ?spotify ?appleMusic WHERE {
      ?item rdfs:label "${artistName}"@en .
      ?item wdt:P31/wdt:P279* wd:Q215380 .
      OPTIONAL { ?item wdt:P434 ?mbid }
      OPTIONAL { ?item wdt:P1953 ?discogs }
      OPTIONAL { ?item wdt:P1902 ?spotify }
      OPTIONAL { ?item wdt:P2850 ?appleMusic }
    } LIMIT 5
  `;

  const results = await queryWikidata(sparql);

  // 2. Handle disambiguation if multiple results
  if (results.length > 1) {
    // Present options to user or use additional context
  }

  // 3. Fall back to service-specific search for missing IDs
  const ids = results[0] ?? {};

  if (!ids.mbid) {
    ids.mbid = await searchMusicBrainz(artistName);
  }

  return ids;
}
```

### Caching Strategy

```typescript
const CACHE_TTL: Record<string, number> = {
  musicbrainz: 24 * 60 * 60 * 1000,   // 24 hours (critical due to rate limit)
  discogs: 12 * 60 * 60 * 1000,       // 12 hours
  lastfm: 6 * 60 * 60 * 1000,         // 6 hours (similarity changes)
  spotify: 6 * 60 * 60 * 1000,        // 6 hours
  wikidata: 24 * 60 * 60 * 1000,      // 24 hours (stable)
  appleMusic: {
    catalog: 12 * 60 * 60 * 1000,     // 12 hours
    user: 5 * 60 * 1000,              // 5 minutes (user data is dynamic)
  },
};
```

### Rate Limit Orchestration

```typescript
interface RateLimiter {
  canRequest(): boolean;
  waitForSlot(): Promise<void>;
  recordRequest(): void;
}

// Per-service rate limiters
const rateLimiters: Record<string, RateLimiter> = {
  musicbrainz: createRateLimiter({ maxRequests: 1, windowMs: 1100 }),
  discogs: createRateLimiter({ maxRequests: 60, windowMs: 60000 }),
  lastfm: createRateLimiter({ maxRequests: 5, windowMs: 1000 }),
  spotify: createRateLimiter({ maxRequests: 30, windowMs: 30000 }),
};
```

### Error Handling

```typescript
// Unified error type
class MusicAPIError extends Error {
  constructor(
    message: string,
    public source: 'apple' | 'musicbrainz' | 'discogs' | 'lastfm' | 'spotify' | 'wikidata',
    public code: 'rate_limited' | 'auth_expired' | 'not_found' | 'network' | 'unknown',
    public retryAfter?: number,
    public retryable: boolean = false
  ) {
    super(message);
  }
}

// Handle rate limit responses consistently
function handleRateLimitResponse(response: Response, source: string): never {
  const retryAfter = parseInt(response.headers.get('Retry-After') || '60') * 1000;
  throw new MusicAPIError(
    `Rate limited by ${source}`,
    source as any,
    'rate_limited',
    retryAfter,
    true
  );
}
```

### Parallel Fetching with Fallbacks

```typescript
async function getArtistData(ids: ArtistIdentifiers): Promise<AggregatedArtistData> {
  const results = await Promise.allSettled([
    ids.mbid ? fetchMusicBrainz(ids.mbid) : Promise.resolve(null),
    ids.discogs ? fetchDiscogs(ids.discogs) : Promise.resolve(null),
    ids.spotify ? fetchSpotifyRelated(ids.spotify) : Promise.resolve(null),
    fetchLastfmSimilar(ids.name),
  ]);

  return {
    relationships: results[0].status === 'fulfilled' ? results[0].value : null,
    discography: results[1].status === 'fulfilled' ? results[1].value : null,
    relatedArtists: results[2].status === 'fulfilled' ? results[2].value : null,
    similarArtists: results[3].status === 'fulfilled' ? results[3].value : null,
    errors: results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map(r => r.reason),
  };
}
```

---

## Appendix: TypeScript Type Definitions

```typescript
// Unified identifier type
interface ArtistIdentifiers {
  name: string;
  mbid?: string;           // MusicBrainz UUID
  discogs?: string;        // Numeric string
  spotify?: string;        // Spotify ID
  appleMusic?: string;     // Apple Music ID
  wikidata?: string;       // Q-ID
}

// MusicBrainz relationship
interface MBRelationship {
  type: string;
  typeId: string;
  direction: 'forward' | 'backward';
  begin?: string;
  end?: string;
  ended: boolean;
  attributes: string[];
  artist: {
    id: string;
    name: string;
    disambiguation?: string;
  };
}

// Aggregated artist data
interface AggregatedArtistData {
  identifiers: ArtistIdentifiers;
  relationships: MBRelationship[] | null;
  members: DiscogsMember[] | null;
  similarArtists: SimilarArtist[] | null;
  relatedArtists: SpotifyArtist[] | null;
  biography?: string;
  tags: string[];
  errors: Error[];
}

// Similar artist (Last.fm)
interface SimilarArtist {
  name: string;
  mbid?: string;
  match: number;  // 0-1 similarity score
  url: string;
}

// Discogs member
interface DiscogsMember {
  id: number;
  name: string;
  active: boolean;
}

// Rate limiter config
interface RateLimiterConfig {
  maxRequests: number;
  windowMs: number;
  queueExcess?: boolean;
}

// Unified API error
interface MusicAPIErrorDetails {
  source: 'apple' | 'musicbrainz' | 'discogs' | 'lastfm' | 'spotify' | 'wikidata';
  code: 'rate_limited' | 'auth_expired' | 'not_found' | 'network' | 'unknown';
  retryAfter?: number;
  retryable: boolean;
}
```

---

## Conclusion

Building a music discovery application requires orchestrating multiple complementary APIs:

1. **MusicBrainz** for artist relationships (with 24hr caching due to 1 req/sec limit)
2. **Wikidata** as the identifier crosswalk
3. **Last.fm** for similarity scores
4. **Spotify** for related artists and audio features
5. **Discogs** for discography and label data
6. **Apple Music** for user library and playback

Use `Promise.allSettled` for resilient parallel fetching, implement per-service rate limiting, and cache aggressively to build a responsive, reliable application.
