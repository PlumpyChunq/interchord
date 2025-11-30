# Smart Apple Music - Project Progress

> Last Updated: 2025-11-30

## Current Status: **Phase 2 - Graph Visualization Complete**

---

## Completed

### Phase 0: Planning & Documentation
- [x] Initial CLAUDE.md project specification
- [x] Music API research and documentation (music-api-discovery.md)
- [x] Decided on Graph-First MVP approach (zero cost)
- [x] Selected tech stack:
  - Package manager: pnpm
  - State management: TanStack Query + Zustand
  - Graph visualization: Cytoscape.js
  - UI: shadcn/ui + Tailwind CSS
  - Deployment: Vercel (free tier)
- [x] Documented all free APIs (MusicBrainz, Discogs, Last.fm, Wikidata, Spotify)
- [x] Created comprehensive API integration guide

### Phase 1: MVP Foundation
- [x] Initialize Next.js 16 project with pnpm
- [x] Configure TypeScript, ESLint, Tailwind CSS
- [x] Set up project structure per CLAUDE.md
- [x] Install and configure shadcn/ui (button, input, card components)
- [x] Install TanStack Query, Zustand, Cytoscape.js
- [x] Create MusicBrainz API client with rate limiting (1 req/sec)
- [x] Create TypeScript type definitions
- [x] Create localStorage cache utility
- [x] Set up TanStack Query provider
- [x] Create TanStack Query hooks for MusicBrainz
- [x] Create artist search interface
- [x] Add artist detail view with relationships
- [x] Add founding member detection and "Founding" badges
- [x] Add "Current" badges for active members
- [x] Show tenure years (e.g., "1981–present", "1983–1989")
- [x] Sort members: founding first, then current, then former
- [x] Test with "Butthole Surfers" - working!

### Phase 2: Graph Visualization
- [x] Create Cytoscape.js React wrapper component
- [x] Design graph node/edge styling (groups=blue/large, persons=green, edges by type)
- [x] Implement click-to-select and double-click-to-expand
- [x] Add graph controls (zoom in/out, fit, reset)
- [x] Add legend showing node types and edge meanings
- [x] Integrate List/Graph toggle into artist detail page
- [x] Test with "Butthole Surfers" - graph displays all 8 members!

---

## In Progress

### Phase 3: Extended Discovery (MusicBrainz Deep Dive)
Leverage ALL MusicBrainz relationship types for richer discovery:

#### Artist-Artist Relationships
- [ ] Member of Band (already implemented)
- [ ] Founder (already implemented)
- [ ] Subgroup (band spawned from another band)
- [ ] Supporting Musician (long-term instrumental/vocal support)
- [ ] Collaboration (short-term project)
- [ ] Teacher/Student relationships
- [ ] Tribute bands

#### Artist-Recording Relationships (NEW - Guest Appearances!)
- [ ] Performer/Guest appearances on tracks
- [ ] Producer credits (who produced for whom)
- [ ] Remixer connections
- [ ] "Samples from artist" (sample chains!)
- [ ] Engineer credits

#### Artist-Label Relationships (NEW - Same Label!)
- [ ] Recording contracts (find labelmates)
- [ ] Label founder/owner connections

#### Discovery Algorithms
- [ ] Side projects finder (via subgroup + collaboration)
- [ ] Collaborator chains (A played with B who played with C)
- [ ] Producer networks (artists sharing producers)
- [ ] Sample genealogy (who sampled whom)
- [ ] Labelmate discovery
- [ ] "6 degrees of separation" pathfinding

#### UI Enhancements
- [ ] Filter graph by relationship type
- [ ] Discovery results panel
- [ ] "Explore connections" mode

---

## Upcoming

### Phase 4: MusicBrainz Database Mirror (Proxmox VM)
**Priority: Move up after basic discovery works** - Eliminates rate limiting!

#### VM System Requirements (Bluemont Proxmox Lab)

| Resource | With Search | Without Search | Notes |
|----------|-------------|----------------|-------|
| **CPU** | 16 threads | 2 threads | x86-64 architecture |
| **RAM** | 16 GB | 4 GB | More = better query performance |
| **Disk** | 350 GB SSD | 100 GB SSD | SSD strongly recommended |
| **OS** | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS | Linux required (no Windows) |

#### Software Stack
- Docker Compose 2+
- PostgreSQL 16 (via Docker)
- Solr 4.1.0 (for search indexes)
- Git, Bash 4+

#### Setup Tasks
- [ ] Create Ubuntu 22.04 VM in Proxmox
- [ ] Install Docker and Docker Compose
- [ ] Clone musicbrainz-docker repository
- [ ] Run initial database import (~4-6 hours)
- [ ] Configure replication (live data feed)
- [ ] Set up search indexes (optional, +60GB)
- [ ] Create API endpoint for our app
- [ ] Update app to use local DB instead of public API

#### Benefits
- **No rate limits** - instant queries
- **Full relationship data** - all entity types
- **Offline capability** - works without internet
- **Custom queries** - direct SQL access
- **Historical data** - edit history available

### Phase 5: Polish & Deploy
- [ ] Error handling and loading states
- [ ] Mobile responsive design
- [ ] Performance optimization
- [ ] Deploy frontend to Vercel
- [ ] Write user documentation

### Phase 6: Multi-Artist Connection Finder
- [ ] Input multiple bands/artists (e.g., 5 bands from different scenes)
- [ ] Find all connections between them:
  - [ ] Shared members (played in multiple bands)
  - [ ] Cover songs (via recording relationships)
  - [ ] Toured together / opening acts
  - [ ] Collaborations / guest appearances
  - [ ] Shared producers
  - [ ] Same record label
  - [ ] Sample connections
- [ ] Visualize connection web in Cytoscape graph
- [ ] Highlight shortest paths between any two artists
- [ ] "Connection strength" scoring

### Phase 7: Data Enrichment Layer
- [ ] Wikidata ID crosswalk (link MusicBrainz ↔ Wikipedia ↔ Discogs)
- [ ] Discogs API for additional metadata (images, genres)
- [ ] Last.fm for play counts and similar artists
- [ ] Wikipedia summaries via Wikidata
- [ ] Merge and deduplicate data from all sources
- [ ] Store enriched profiles in local database

### Future: Apple Music Integration
- [ ] Apple Developer Program enrollment ($99/year)
- [ ] MusicKit.js integration
- [ ] User authentication flow
- [ ] Library access and analysis
- [ ] Playlist creation/sync
- [ ] Playback integration

### Future: Band Timeline Component
A horizontal timeline panel at the bottom of the artist detail page showing the band's history:

#### Visual Design
- Long horizontal scrollable timeline (full width at bottom of page)
- Spans from band formation to present (or dissolution)
- Interactive zoom/scroll for detailed exploration

#### Timeline Events to Display
- [ ] **Band Formation** - Start date with founding members
- [ ] **Album Releases** - Major releases with cover art thumbnails
- [ ] **Member Changes** - Joins, departures, lineup changes
- [ ] **Pivotal Moments** - Major tours, breakthrough events
- [ ] **Hiatus Periods** - Visual gaps or different styling
- [ ] **Band End** - Dissolution date (if applicable)

#### Data Sources
- MusicBrainz: Formation dates, member tenure, release dates
- Discogs: Album release dates, detailed discography
- Wikidata: Major events, tours, awards
- Wikipedia: Historical context (via Wikidata links)

#### Technical Implementation
- [ ] Research timeline visualization libraries (vis-timeline, react-chrono, etc.)
- [ ] Aggregate event data from MusicBrainz releases + relationships
- [ ] Design responsive horizontal scroll UI
- [ ] Add event filtering (albums only, members only, etc.)
- [ ] Sync timeline position with graph selection (click member → highlight tenure)

#### Example: Butthole Surfers Timeline
```
1981 ─────── 1983 ─────── 1987 ─────── 1996 ─────── 2009 ───── Present
  │            │            │            │            │
  ▼            ▼            ▼            ▼            ▼
Formation   Brown Reason  Locust      Electricl.  Touring
            to Live       Abortion    Larryland   Resumes
                          Tech.
            ┌─────────────────────────────────────────────────────┐
            │ Paul Leary (founding) ─────────────────────────────→│
            │ Gibby Haynes (founding) ────────────────────────────→│
            │ Teresa Taylor ─────────┤ (1983-1989)                 │
            │ Jeff Pinkus ────────────────────────────────────────→│
            └─────────────────────────────────────────────────────┘
```

---

## Key Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| MVP Approach | Graph-First | Zero cost, proves core value before investment |
| Package Manager | pnpm | Fast, efficient disk usage |
| State Management | TanStack Query + Zustand | Query handles server state, Zustand for UI state |
| Deployment | Vercel Free Tier | Zero cost, excellent Next.js support |
| Database (MVP) | None (localStorage) | Defer until data merging needed |
| Cache (MVP) | In-memory + localStorage | Sufficient for single-user MVP |
| Database (Phase 4) | MusicBrainz Mirror | Full PostgreSQL mirror eliminates rate limits |
| VM Platform | Proxmox (Bluemont Lab) | Existing infrastructure, easy to provision |
| Last.fm | Phase 7 enrichment | Nice-to-have after core discovery works |

---

## MusicBrainz Relationship Types Reference

### Artist ↔ Artist
| Type | Description | Discovery Use |
|------|-------------|---------------|
| `member of band` | Person is/was member of group | Band member graphs |
| `founder` | Person founded a group | Founding member badges |
| `subgroup` | Band spawned from another band | Side project discovery |
| `supporting musician` | Long-term instrumental/vocal support | Extended network |
| `collaboration` | Short-term project between artists | Collaboration chains |
| `teacher` | Teacher/student relationship | Influence mapping |
| `tribute` | Tribute band to another artist | Fan connections |

### Artist ↔ Recording
| Type | Description | Discovery Use |
|------|-------------|---------------|
| `performer` | Artist performed on recording | **Guest appearances!** |
| `producer` | Produced the recording | Producer networks |
| `remixer` | Remixed the recording | Remix connections |
| `samples from artist` | Recording samples another artist | **Sample genealogy!** |
| `engineer` | Engineering credits | Behind-the-scenes connections |

### Artist ↔ Label
| Type | Description | Discovery Use |
|------|-------------|---------------|
| `recording contract` | Artist signed to label | **Labelmate discovery!** |
| `label founder` | Artist founded the label | Industry connections |
| `owner` | Artist owns the label | Business relationships |

### Data Licensing
| Data Type | License | Commercial Use |
|-----------|---------|----------------|
| Core data (artists, releases, recordings) | CC0 (Public Domain) | ✅ Free |
| Derived data (tags, ratings, annotations) | CC BY-NC-SA 3.0 | ❌ Non-commercial only |
| Edit history | CC BY-NC-SA 3.0 | ❌ Non-commercial only |

---

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── globals.css         # Tailwind + shadcn styles
│   ├── layout.tsx          # Root layout with Providers
│   └── page.tsx            # Home page with search/detail
├── components/
│   ├── ui/                 # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   └── input.tsx
│   ├── providers.tsx       # TanStack Query provider
│   ├── artist-search.tsx   # Artist search component
│   ├── artist-detail.tsx   # Artist detail with relationships
│   └── graph/              # Graph components (Phase 2)
├── lib/
│   ├── cache/              # localStorage cache
│   │   └── index.ts
│   ├── musicbrainz/        # MusicBrainz API client
│   │   ├── client.ts       # Rate-limited client
│   │   ├── hooks.ts        # TanStack Query hooks
│   │   └── index.ts
│   └── utils.ts            # shadcn utilities
├── services/
│   └── graph/              # Graph service (Phase 2)
└── types/
    └── index.ts            # TypeScript definitions
```

---

## Database Architecture

### Phase 4: MusicBrainz Mirror (PostgreSQL)

Full MusicBrainz database running locally - no custom schema needed!
Uses official `musicbrainz-docker` with built-in schema.

**Key tables we'll query:**
```sql
-- Artists (persons and groups)
artist (id, name, type, area, begin_date, end_date, ...)

-- Artist-to-Artist relationships
l_artist_artist (link, entity0, entity1)
link (link_type, begin_date, end_date, ...)
link_type (name, description, ...)  -- 'member of band', 'founder', etc.

-- Artist-to-Recording relationships (guest appearances!)
l_artist_recording (link, entity0, entity1)

-- Artist-to-Label relationships (labelmates!)
l_artist_label (link, entity0, entity1)

-- Labels
label (id, name, type, area, ...)
```

### Phase 7: Enrichment Layer (Custom Tables)

Additional tables for merged data from other sources:

```sql
-- Cross-reference IDs from multiple sources
artist_external_ids
  - mbid (MusicBrainz ID, primary)
  - discogs_id
  - lastfm_id
  - wikidata_id
  - spotify_id

-- Enriched metadata not in MusicBrainz
artist_enrichment
  - mbid (foreign key)
  - wikipedia_summary
  - image_url
  - genres (from Discogs/Last.fm)
  - play_count (from Last.fm)
  - similar_artists (from Last.fm)
  - last_enriched_at

-- User-specific data
user_annotations
  - id
  - mbid
  - note
  - created_at
```

---

## Session Notes

### 2025-11-30 (Session 1)
- Completed all planning documentation
- Rewrote CLAUDE.md with Graph-First MVP approach
- Created comprehensive music-api-discovery.md
- Ready to begin Phase 1 implementation

### 2025-11-30 (Session 2)
- Initialized Next.js 16 project with pnpm
- Set up project directory structure
- Installed shadcn/ui with button, input, card components
- Installed TanStack Query, Zustand, Cytoscape.js
- Created MusicBrainz API client with request queue rate limiting
- Created TypeScript type definitions for artists, graphs, relationships
- Created localStorage cache utility
- **Next:** Build artist search UI

### 2025-11-30 (Session 3)
- Set up TanStack Query provider in layout
- Created TanStack Query hooks for MusicBrainz (useArtistSearch, useArtistRelationships, useArtistGraph)
- Built artist search component with live search
- Built artist detail component showing relationships
- Updated main page to toggle between search and detail views
- Tested with "Butthole Surfers" - successfully returns band members
- Fixed bug in groupRelationshipsByType function (wasn't matching artist IDs)
- Added enhanced member display:
  - "Founding" badge for original members (within first 2 years)
  - "Current" badge for active members
  - Tenure display: "1981–present" or "1983–1989"
  - Smart sorting: founding → current → former members
  - Instruments shown in blue (e.g., "drums (drum set)")
- Discussed future database for caching and merging API data
- **Phase 1 MVP Foundation Complete!**

### 2025-11-30 (Session 4)
- Created Cytoscape.js React wrapper component (artist-graph.tsx)
- Designed comprehensive graph styling:
  - Groups (bands): blue, 60px, larger font
  - Persons: emerald green, 40px
  - Founding members: amber border (4px)
  - Root node: 80px with dark border
  - Unexpanded nodes: dashed border, semi-transparent
- Implemented edge styling by relationship type:
  - member_of: solid blue
  - founder_of: amber, thicker
  - collaboration: dashed green
- Added COSE layout with animation (500ms)
- Created graph controls component (zoom in/out, fit, reset)
- Built GraphView wrapper combining graph + controls + legend
- Integrated List/Graph toggle into artist detail page
- Tested with "Butthole Surfers":
  - Graph shows band as large blue center node
  - 8 members displayed as green nodes
  - Blue edges connect members to band
  - Click to select, double-click to expand works
- **Phase 2 Graph Visualization Complete!**

### 2025-11-30 (Session 5)
- Deep dive into MusicBrainz database documentation
- Discovered expanded relationship types:
  - Artist-Recording: guest appearances, producer credits, samples
  - Artist-Label: recording contracts for labelmate discovery
  - Artist-Artist: subgroups, supporting musicians, collaborations
- Researched MusicBrainz database mirror option:
  - Docker-based setup available
  - VM requirements: 16 threads, 16GB RAM, 350GB SSD (with search)
  - Eliminates rate limiting entirely!
- Updated roadmap:
  - Phase 3 expanded with all MusicBrainz relationship types
  - Phase 4: MusicBrainz Database Mirror (moved up in priority)
  - Phase 6: Multi-Artist Connection Finder
  - Phase 7: Data Enrichment Layer
- Added MusicBrainz Relationship Types Reference section
- Added Proxmox VM requirements for Bluemont lab
- **Research complete, roadmap updated!**

---

## Quick Resume

**Next task:** Phase 3 - Extended Discovery (expand MusicBrainz relationship types)

**Immediate priorities:**
1. Add Artist-Recording relationships (guest appearances, producers)
2. Add Artist-Label relationships (labelmates)
3. Build discovery algorithms (side projects, collaborator chains)

**Future priority (after basic discovery):**
- Phase 4: MusicBrainz Database Mirror in Proxmox VM (eliminates rate limits!)

**Key files:**
- `CLAUDE.md` - Project specification and guidelines
- `music-api-discovery.md` - API integration reference
- `PROGRESS.md` - This file (keep updated!)
- `src/lib/musicbrainz/client.ts` - MusicBrainz API client with rate limiting
- `src/lib/musicbrainz/hooks.ts` - TanStack Query hooks
- `src/components/artist-search.tsx` - Search interface
- `src/components/artist-detail.tsx` - Artist detail with List/Graph toggle
- `src/components/graph/artist-graph.tsx` - Cytoscape.js wrapper
- `src/components/graph/index.tsx` - GraphView with controls
- `src/types/index.ts` - TypeScript definitions

**To test:** `pnpm dev` then open http://localhost:3000
- Search for "Butthole Surfers"
- Click on result to see band members with Founding/Current badges
- Toggle between **List** and **Graph** views
- In List view: Members sorted with Founding/Current badges and tenure years
- In Graph view: Interactive node graph with band as center, members as connected nodes
- Double-click on a member node to expand their relationships
- Click on any artist to navigate to their detail page

**MusicBrainz VM Quick Setup (Phase 4):**
```bash
# On Proxmox: Create Ubuntu 22.04 VM (16 threads, 16GB RAM, 350GB SSD)
git clone https://github.com/metabrainz/musicbrainz-docker.git
cd musicbrainz-docker
docker compose build
docker compose run --rm musicbrainz createdb.sh -fetch  # ~4-6 hours
docker compose up -d
```
