# Smart Apple Music - Music Discovery & Artist Relationship Mapping

## Project Overview

A music discovery application that visualizes artist relationships through interactive graphs and generates discovery recommendations. Uses a **Graph-First MVP approach** with free APIs, deferring paid Apple Music integration until the concept is proven.

## Development Approach

**Graph-First MVP (Zero Cost)**
- Build the unique value prop first: interactive artist relationship graph
- Uses only free APIs: MusicBrainz, Discogs, Last.fm, Wikidata, Wikipedia
- User searches/inputs artists → app builds visual relationship map
- Links out to streaming services for playback (no integration needed)

**Future Phase (Requires $99/year Apple Developer Program)**
- Apple Music library import
- In-app playback
- Playlist generation and sync
- Personalized recommendations based on listening history

## Current Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Graph MVP | NOT STARTED | Free APIs only |
| Phase 2: Discovery Engine | NOT STARTED | Build on graph data |
| Phase 3: Apple Music Integration | FUTURE | Requires $99/year investment |

**Next Step:** Set up Next.js project and implement MusicBrainz artist lookup.

## Architecture

### MVP Architecture (Graph-First, Zero Cost)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 14+)                        │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐   │
│  │   Artist Search     │  │   Interactive Graph Visualizer  │   │
│  │   & Input           │  │   (Cytoscape.js)                │   │
│  └─────────────────────┘  └─────────────────────────────────┘   │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐   │
│  │   Discovery         │  │   External Links                │   │
│  │   Recommendations   │  │   (Spotify/Apple/YouTube)       │   │
│  └─────────────────────┘  └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js API Routes                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Graph     │  │  Discovery  │  │   Caching Layer         │  │
│  │   Builder   │  │  Engine     │  │   (Redis optional)      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────┬───────┴───────┬─────────────┐
        ▼             ▼               ▼             ▼
┌─────────────┐ ┌───────────┐ ┌───────────┐ ┌─────────────┐
│ MusicBrainz │ │  Discogs  │ │  Last.fm  │ │  Wikidata   │
│ (relations) │ │ (members) │ │ (similar) │ │ (ID xwalk)  │
└─────────────┘ └───────────┘ └───────────┘ └─────────────┘
      FREE           FREE          FREE          FREE
```

### Future Architecture (With Apple Music - $99/year)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 14+)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Library    │  │   Graph     │  │   Player Integration    │  │
│  │  Import     │  │  Visualizer │  │   (MusicKit.js)         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Backend API                              │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────────────┐
│  Apple Music  │   │  Free APIs    │   │  PostgreSQL + Redis   │
│  API ($99/yr) │   │  (as above)   │   │  (user data, cache)   │
└───────────────┘   └───────────────┘   └───────────────────────┘
```

## Tech Stack

### MVP Stack (Zero Cost)

| Component | Technology | Version | Notes |
|-----------|------------|---------|-------|
| Runtime | Node.js | 20 LTS | |
| Package Manager | pnpm | 8+ | Faster installs, strict deps |
| Frontend | Next.js | 14+ | App Router, RSC, API routes |
| Graph Visualization | Cytoscape.js | 3.x | Interactive, supports large graphs |
| UI Components | shadcn/ui + Tailwind CSS | Latest | Clean, accessible |
| State Management | TanStack Query + Zustand | 5.x / 4.x | Server state + minimal client state |
| Cache | In-memory / localStorage | — | No Redis needed for MVP |
| Testing | Vitest | Latest | Unit tests |

### Future Additions (When Scaling)

| Component | Technology | When to Add |
|-----------|------------|-------------|
| Database | PostgreSQL + Prisma | User accounts, saved graphs |
| Cache | Redis / Upstash | High traffic, rate limit tracking |
| Apple Music | MusicKit.js | $99/year investment |
| E2E Testing | Playwright | Before production launch |

### External APIs (All Free for MVP)

| API | Purpose | Rate Limit | Auth | Cost |
|-----|---------|------------|------|------|
| MusicBrainz | Artist relationships, band members | **1 req/sec** (strict) | User-Agent header | FREE |
| Discogs | Members, aliases, discography | 60 req/min (auth) | Token | FREE |
| Last.fm | Similar artists, tags, popularity | ~5 req/sec | API key | FREE |
| Wikidata | ID crosswalk between services | ~500 req/hr | User-Agent | FREE |
| Wikipedia | Artist biographies | ~200 req/sec | None | FREE |

### Future API (Requires Investment)

| API | Purpose | Rate Limit | Auth | Cost |
|-----|---------|------------|------|------|
| Apple Music | User library, playback, playlists | ~20 req/sec | MusicKit JWT + User Token | **$99/year** |

## API Capabilities for MVP

### What the Free APIs Provide

| Capability | Primary Source | Fallback |
|------------|---------------|----------|
| Band members (current/former) | MusicBrainz | Discogs |
| Side projects & supergroups | MusicBrainz | Discogs `groups` |
| Collaborations | MusicBrainz | — |
| Similar artists (scored) | Last.fm | — |
| Genre tags | Last.fm | MusicBrainz |
| Artist biography | Wikipedia | Last.fm |
| ID crosswalk | Wikidata | MusicBrainz URL-rels |
| Discography | Discogs | MusicBrainz |

### Critical Rate Limit: MusicBrainz

MusicBrainz has a **strict 1 request/second limit**. Exceeding it returns HTTP 503 for ALL subsequent requests.

**Mitigation strategies:**
- Queue requests with 1.1 second minimum delay
- Cache aggressively (24-48 hour TTL)
- Use batch lookups where API supports it
- Pre-fetch popular artists

### API Key Requirements

| API | How to Get Key |
|-----|----------------|
| MusicBrainz | No key needed - just set User-Agent header |
| Discogs | https://www.discogs.com/settings/developers |
| Last.fm | https://www.last.fm/api/account/create |
| Wikidata | No key needed - just set User-Agent header |

### Future: Apple Music (When Ready)

When the $99/year investment is justified, Apple Music adds:
- User library import (what artists they already like)
- In-app playback
- Playlist generation and sync
- "Heavy rotation" data for personalization

**Limitation:** Even with Apple Music, you still need MusicBrainz for artist relationships - Apple doesn't provide this data.

## Phase 1: Data-Driven Music Discovery

### Discovery Strategies

| Strategy | Description | Data Source |
|----------|-------------|-------------|
| Deep Cuts | Lesser-known tracks from favorite artists | Apple Music catalog + Last.fm popularity |
| Side Projects | Solo work, supergroups, collaborations | MusicBrainz artist relations |
| Era Exploration | Different periods of an artist's career | Album release dates |
| Genre Adjacent | Similar genres the user hasn't explored | Last.fm tags + Apple recommendations |
| Scene Mapping | Artists from same scene/label/city | Discogs label data, MusicBrainz area |
| Collaborator Chain | "If you like X, try their collaborator Y" | MusicBrainz/Discogs credits |

### Playlist Theme Types
- `deep_cuts` - Lesser-known tracks from favorite artists
- `side_projects` - Solo work, supergroups, collaborations
- `era_exploration` - Different periods of an artist's career
- `genre_adjacent` - Similar genres not yet explored
- `mood_based` - Based on inferred mood signals
- `collaborator_chain` - Recommendations through artist collaborations
- `custom` - User-defined themes

## Phase 2: Artist Relationship Graph

### Relationship Types
- `member_of` - Person is/was member of band
- `founder_of` - Founded the band/group
- `side_project` - Related side project
- `collaboration` - Featured/collaborated on tracks
- `producer` - Produced for the artist
- `influenced_by` - Musical influence
- `same_scene` - Same musical scene (e.g., "Seattle grunge scene")
- `same_label` - Same record label
- `touring_member` - Touring/session musician

### Graph Output Format
Use Cytoscape.js-compatible format with nodes and edges. Support progressive loading for performance.

## MCP Server Tools

### get_user_music_profile
Fetch aggregated user music data from Apple Music.

```typescript
// Input
interface GetUserMusicProfileInput {
  userToken: string;
  includeRecentlyPlayed?: boolean;  // default: true
  includeHeavyRotation?: boolean;   // default: true
  includeLibrary?: boolean;         // default: true
  libraryLimit?: number;            // default: 100
}

// Output
interface UserMusicProfile {
  userId: string;
  library: {
    artists: LibraryArtist[];
    albums: LibraryAlbum[];
    songs: LibrarySong[];
  };
  recentlyPlayed: RecentTrack[];
  heavyRotation: HeavyRotationItem[];
  genres: GenreBreakdown[];
  fetchedAt: string;
}
```

### generate_playlist
Generate a themed playlist based on user profile and strategy.

```typescript
// Input
interface GeneratePlaylistInput {
  userProfile: UserMusicProfile;
  theme: PlaylistTheme;
  trackCount?: number;           // default: 25
  excludeLibrary?: boolean;      // default: false (include library tracks)
  eraRange?: { start: number; end: number };  // for era_exploration
  seedArtists?: string[];        // Apple Music artist IDs
}

// Output
interface GeneratedPlaylist {
  id: string;
  name: string;
  description: string;
  theme: PlaylistTheme;
  tracks: PlaylistTrack[];
  reasoning: string[];           // Why each track was included
  generatedAt: string;
}
```

### sync_playlist_to_apple_music
Create or update a playlist in the user's Apple Music library.

```typescript
// Input
interface SyncPlaylistInput {
  userToken: string;
  playlist: GeneratedPlaylist;
  existingPlaylistId?: string;   // If updating existing
}

// Output
interface SyncPlaylistOutput {
  success: boolean;
  playlistId: string;
  playlistUrl: string;
  tracksAdded: number;
  tracksFailed: { id: string; reason: string }[];
}
```

### get_artist_graph
Get relationship graph for an artist from external sources.

```typescript
// Input
interface GetArtistGraphInput {
  artistName: string;
  appleMusicId?: string;
  depth?: number;                // default: 1 (direct connections only)
  relationshipTypes?: RelationshipType[];  // filter specific types
}

// Output
interface ArtistGraph {
  nodes: ArtistNode[];
  edges: ArtistRelationship[];
  centerArtistId: string;
  sources: ('musicbrainz' | 'discogs' | 'lastfm')[];
  fetchedAt: string;
}
```

### expand_artist_node
Fetch additional connections for a specific artist node.

```typescript
// Input
interface ExpandArtistNodeInput {
  artistId: string;              // Internal graph node ID
  musicbrainzId?: string;
  relationshipTypes?: RelationshipType[];
}

// Output: ArtistGraph (merged with existing)
```

### search_apple_music
Search the Apple Music catalog.

```typescript
// Input
interface SearchAppleMusicInput {
  query: string;
  types: ('artists' | 'albums' | 'songs' | 'playlists')[];
  limit?: number;                // default: 25
  storefront?: string;           // default: 'us'
}

// Output
interface SearchResults {
  artists?: AppleMusicArtist[];
  albums?: AppleMusicAlbum[];
  songs?: AppleMusicSong[];
  playlists?: AppleMusicPlaylist[];
}
```

## Development Guidelines

### Code Organization
```
/src
  /app                    # Next.js App Router pages
    /api                  # API routes (developer token endpoint)
    /(auth)               # Auth-related pages
    /discover             # Playlist discovery UI
    /graph                # Artist graph UI
  /components             # React components
    /ui                   # shadcn/ui components
    /playlist             # Playlist-related components
    /graph                # Graph visualization components
  /lib                    # Utilities and helpers
    /apple-music          # Apple Music API client
    /musicbrainz          # MusicBrainz API client
    /discogs              # Discogs API client
    /lastfm               # Last.fm API client
    /cache                # Redis caching utilities
    /rate-limit           # Rate limiting utilities
  /services               # Business logic
    /discovery            # Playlist discovery engine
    /graph                # Graph building service
  /types                  # TypeScript type definitions
  /mcp                    # MCP server tools
/prisma
  schema.prisma           # Database schema
  /migrations             # Database migrations
/tests
  /unit                   # Unit tests
  /integration            # Integration tests
  /e2e                    # Playwright E2E tests
  /mocks                  # API mocks for testing
```

### Coding Style

**TypeScript**
- Strict mode enabled (`strict: true` in tsconfig)
- Prefer `interface` over `type` for object shapes
- Use `unknown` over `any`; narrow types explicitly
- Export types from `/types` directory, not inline

**React/Next.js**
- Functional components only (no class components)
- Use React Server Components by default; add `'use client'` only when needed
- Colocate component-specific types in the component file

**State Management**
- **TanStack Query:** All server/async state (API calls, caching, loading states, mutations)
- **Zustand:** Minimal client state only:
  - Auth/user session (if not using cookies)
  - Graph view settings (zoom, selected node, filters)
  - UI preferences (theme, sidebar state)
- **Local state (useState):** Component-specific UI state (form inputs, modals, tooltips)
- Do NOT use Zustand for data that comes from APIs - that's TanStack Query's job

**Naming Conventions**
- Components: `PascalCase` (e.g., `PlaylistCard.tsx`)
- Utilities/hooks: `camelCase` (e.g., `useAppleMusic.ts`)
- Types/interfaces: `PascalCase` (e.g., `UserMusicProfile`)
- Constants: `SCREAMING_SNAKE_CASE`
- Files: `kebab-case` for non-components (e.g., `rate-limit.ts`)

**Imports**
```typescript
// Order: external → internal → relative → types
import { useQuery } from '@tanstack/react-query';

import { redis } from '@/lib/cache';
import { AppleMusicClient } from '@/lib/apple-music';

import { PlaylistCard } from './PlaylistCard';

import type { GeneratedPlaylist } from '@/types';
```

### TypeScript Types

Core interfaces (define in `/src/types/`):
- `UserMusicProfile` - User's music data from Apple Music
- `GeneratedPlaylist` - Output playlist with tracks and metadata
- `PlaylistTrack` - Individual track in a playlist
- `ArtistNode` - Node in artist relationship graph
- `ArtistRelationship` - Edge in artist relationship graph
- `ArtistGraph` - Complete graph structure (Cytoscape.js compatible)

### Database Schema (Prisma)

```prisma
model User {
  id              String    @id @default(cuid())
  appleMusicId    String?   @unique
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  playlists       Playlist[]
  cachedProfile   CachedProfile?
}

model CachedProfile {
  id              String    @id @default(cuid())
  userId          String    @unique
  user            User      @relation(fields: [userId], references: [id])
  profileData     Json      // UserMusicProfile
  fetchedAt       DateTime
  expiresAt       DateTime
}

model Playlist {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  appleMusicId    String?   // If synced to Apple Music
  name            String
  theme           String
  trackData       Json      // GeneratedPlaylist
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model ArtistCache {
  id              String    @id @default(cuid())
  musicbrainzId   String?   @unique
  appleMusicId    String?
  name            String
  relationships   Json      // Cached relationships
  fetchedAt       DateTime
  expiresAt       DateTime

  @@index([appleMusicId])
  @@index([name])
}
```

### Caching Strategy

| Data Type | Storage | TTL | Invalidation |
|-----------|---------|-----|--------------|
| User library | Redis | 1 hour | On explicit refresh |
| User profile | Postgres + Redis | 1 hour | On library change |
| Catalog search | Redis | 24 hours | None (shared) |
| Artist relationships | Postgres | 1 week | Manual update |
| Generated playlists | Postgres | Permanent | User deletion |

### Rate Limiting Implementation

```typescript
// Use a token bucket or sliding window for each API
interface RateLimiter {
  canMakeRequest(): Promise<boolean>;
  waitForSlot(): Promise<void>;
  recordRequest(): void;
}

// MusicBrainz: Strict 1 req/sec
const musicBrainzLimiter = createRateLimiter({
  maxRequests: 1,
  windowMs: 1000,
  queueExcess: true,  // Queue requests instead of failing
});

// Discogs: 60 req/min with auth
const discogsLimiter = createRateLimiter({
  maxRequests: 60,
  windowMs: 60000,
});

// Last.fm: 5 req/sec
const lastfmLimiter = createRateLimiter({
  maxRequests: 5,
  windowMs: 1000,
});
```

### Error Handling

```typescript
// Custom error types
class AppleMusicError extends Error {
  constructor(
    message: string,
    public code: 'rate_limited' | 'auth_expired' | 'not_found' | 'api_error',
    public retryAfter?: number
  ) {
    super(message);
  }
}

class ExternalAPIError extends Error {
  constructor(
    message: string,
    public source: 'musicbrainz' | 'discogs' | 'lastfm',
    public code: string,
    public retryable: boolean
  ) {
    super(message);
  }
}
```

**Error handling patterns:**
- `rate_limited` - Queue request, wait for slot, retry automatically
- `auth_expired` - Return error to frontend, prompt reauthorization
- `not_found` - Return empty result, log for debugging
- `external_api_failure` - Use cached data if available, degrade gracefully

## Authentication & Security

### MusicKit.js Setup (Frontend)
```typescript
// Request developer token from your API
const response = await fetch('/api/apple-music/token');
const { developerToken } = await response.json();

const musicKit = await MusicKit.configure({
  developerToken,
  app: {
    name: 'Smart Apple Music',
    build: '1.0.0'
  }
});

// Request user authorization
const userToken = await musicKit.authorize();
// Store userToken securely (httpOnly cookie recommended)
```

### Security Requirements

**Token Handling**
- Developer token (JWT): Generate server-side, short expiry (24h max)
- User token: Store in httpOnly, secure, sameSite cookie
- Never expose tokens in client-side JavaScript or logs
- Rotate developer tokens before expiry

**Environment Variables**
- Never commit `.env` files
- Use different credentials for dev/staging/prod
- Validate all env vars at startup

**CORS Configuration**
```typescript
// next.config.js - restrict to your domains
const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
```

**API Security**
- Validate user tokens on every request
- Rate limit by user ID, not just IP
- Sanitize all user inputs
- Use parameterized queries (Prisma handles this)

## Testing

### Test Framework
- **Unit/Integration:** Vitest (fast, ESM-native)
- **E2E:** Playwright
- **API Mocking:** MSW (Mock Service Worker)

### Test Organization
```
/tests
  /unit
    /services
      discovery.test.ts
      graph.test.ts
    /lib
      rate-limit.test.ts
  /integration
    /api
      apple-music-client.test.ts
      musicbrainz-client.test.ts
  /e2e
    playlist-generation.spec.ts
    artist-graph.spec.ts
  /mocks
    /handlers
      apple-music.ts
      musicbrainz.ts
    server.ts
```

### Testing Patterns

```typescript
// Mock external APIs with MSW
import { setupServer } from 'msw/node';
import { appleMusicHandlers } from './mocks/handlers/apple-music';

const server = setupServer(...appleMusicHandlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

**Coverage Expectations**
- Services/business logic: 80%+
- API clients: 70%+ (focus on error handling)
- Components: 60%+ (focus on interactive elements)
- E2E: Cover critical user flows

### What to Mock (MVP)
- All external APIs (MusicBrainz, Discogs, Last.fm, Wikidata)
- Time-dependent functions

### What NOT to Mock
- Internal services (test integration)
- Cache layer (use real in-memory cache)

## Deployment

### Target Platform: Vercel
Vercel is the chosen deployment platform for this project.

**Why Vercel:**
- Zero-config Next.js deployment
- Automatic preview deployments on PRs
- Edge functions for low-latency API routes
- Built-in analytics and Web Vitals
- Generous free tier for development

### MVP Infrastructure (Free Tier)

| Service | Provider | Cost | Notes |
|---------|----------|------|-------|
| Hosting | Vercel | FREE | Hobby tier supports full Next.js |
| Cache | In-memory / localStorage | FREE | No external service needed |
| Monitoring | Sentry | FREE | 5K errors/month on free tier |
| Analytics | Vercel Analytics | FREE | Built-in |

### Future Infrastructure (When Scaling)

| Service | Provider | Cost | When to Add |
|---------|----------|------|-------------|
| Database | Vercel Postgres / Supabase | $0-20/mo | User accounts, saved graphs |
| Redis | Upstash | Pay-per-use | High traffic, rate limit tracking |
| CDN | Vercel Edge | Included | Already included with Vercel |

### Environment Setup
```bash
# Development
cp .env.example .env.local
pnpm install
pnpm dev

# Production build
pnpm build
pnpm start
```

## Environment Variables

### MVP (Required)

```env
# Free API credentials
MUSICBRAINZ_USER_AGENT=SmartAppleMusic/1.0.0 (your@email.com)
DISCOGS_TOKEN=your_token_here
LASTFM_API_KEY=your_key_here
```

### MVP (Optional)

```env
# Error tracking (free tier available)
SENTRY_DSN=

# If deploying publicly
ALLOWED_ORIGINS=https://yourdomain.com
```

### Future (When Adding Apple Music)

```env
# Requires $99/year Apple Developer Program
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_PRIVATE_KEY=      # Base64 encoded .p8 file contents

# Required when storing user data
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
```

## Implementation Phases

### Phase 1: MVP Foundation (Zero Cost)

**1A: Project Setup**
- [ ] Next.js 14+ project with TypeScript strict mode
- [ ] pnpm, Tailwind CSS, shadcn/ui setup
- [ ] Basic page structure (home, search, graph view)
- [ ] Environment variables for free APIs

**1B: API Clients**
- [ ] MusicBrainz client with 1 req/sec rate limiter
- [ ] Discogs client with auth token
- [ ] Last.fm client for similar artists
- [ ] Wikidata SPARQL client for ID resolution
- [ ] In-memory cache layer (upgrade to Redis later)

**1C: Artist Search & Lookup**
- [ ] Search input with debouncing
- [ ] Artist disambiguation UI (handle multiple "Nirvana" results)
- [ ] Artist detail view (bio, members, groups)
- [ ] External links (Spotify, Apple Music, YouTube)

### Phase 2: Graph Visualization

**2A: Core Graph**
- [ ] Cytoscape.js integration
- [ ] Artist node rendering with images
- [ ] Relationship edge types (member, collaboration, side project)
- [ ] Basic layout algorithm (force-directed)

**2B: Interactive Features**
- [ ] Click node to expand connections
- [ ] Hover for artist preview
- [ ] Filter by relationship type
- [ ] Zoom/pan controls
- [ ] Progressive loading for large graphs

### Phase 3: Discovery Engine

- [ ] "If you like X, explore..." recommendations
- [ ] Similar artists from Last.fm with match scores
- [ ] Side project discovery
- [ ] Collaborator chains
- [ ] Genre/era exploration

### Future: Apple Music Integration ($99/year)

Only pursue when MVP proves valuable:
- [ ] Apple Developer account & MusicKit credentials
- [ ] User library import
- [ ] In-app playback with MusicKit.js
- [ ] Playlist generation based on graph exploration
- [ ] Playlist sync to Apple Music
- [ ] PostgreSQL for user data persistence

## Logging & Monitoring

### Logging Strategy
```typescript
// Use structured logging
import { logger } from '@/lib/logger';

logger.info('Playlist generated', {
  userId: user.id,
  theme: 'deep_cuts',
  trackCount: 25,
  duration: '1.2s',
});

logger.error('MusicBrainz request failed', {
  artistId: 'abc123',
  error: error.message,
  retryable: true,
});
```

### Key Metrics to Track
- Playlist generation success/failure rate
- External API latency and error rates
- Rate limit hits per API
- User engagement (playlists created, synced)

## Notes

- Always prefer official SDK patterns over raw HTTP calls
- Use progressive loading for large graphs to maintain performance
- Cache aggressively to minimize external API calls
- Handle graceful degradation when external APIs are unavailable
- MusicBrainz rate limiting is strictly enforced - queue requests, don't batch
- Use Playwright as needed