# InterChord - Project Progress

> Last Updated: 2025-12-12

## Current Status: **Phase 3 - Extended Discovery (In Progress)**

---

## Feature Checklist

### Music Discovery & Search
- [x] Artist search with MusicBrainz
- [x] Predictive search with autocomplete (Solr-powered)
- [x] Song/recording search (Solr index)
- [x] Album/release search (Solr index)
- [ ] Global search across all types (title, artist, band, year combined)
- [ ] Identify original song and original performer (cover → original work)
- [ ] View original artist profile from cover version
- [ ] Hover over result to refocus main search context
- [ ] Discovery queue (add songs/artists/bands/years for later exploration)
- [ ] Shazam/audio recognition integration (if API available)

### Artist & Relationship Graph
- [x] Artist profiles with biographical data
- [x] Band member relationships (member of, founder)
- [x] Family & relationship links (spouses, children via Wikidata)
- [x] Interactive map showing birthplaces, death locations, residences
- [x] Timeline view for artist history (albums with cover art)
- [ ] Tour locations / shows on map
- [ ] Label relationships (artists → labels they created/own)
- [ ] Producer networks
- [ ] Sample genealogy (who sampled whom)
- [ ] "6 degrees of separation" pathfinding
- [ ] Member tenure visualization on timeline

### Playback & Collection
- [x] Spotify integration (import top/followed artists)
- [x] Apple Music integration (import library artists)
- [ ] Music playback integration (Apple Music/Spotify)
- [ ] Purchase albums (link to stores)
- [ ] Song lists / saved tracks
- [ ] User-created playlists
- [ ] Playlist sync with streaming services

### User Accounts & Data
- [x] Favorites system (localStorage)
- [x] Genre categorization for favorites
- [ ] User database (PostgreSQL)
- [ ] Account creation and login
- [ ] Cross-device sync
- [ ] Backup and recovery of user data
- [ ] Concert memories (tickets, photos, notes)
- [ ] Encryption for sensitive user data

### Infrastructure
- [x] MusicBrainz database mirror (stonefrog-db01)
- [x] Solr search indexes (15 collections)
- [x] Hourly DB replication
- [x] Podman containerization
- [x] Cloudflare tunnel for HTTPS
- [ ] Live Solr indexing (RabbitMQ + SIR)
- [ ] User database backup and recovery
- [ ] Monitoring and alerting
- [ ] Growth/scaling planning
- [ ] Cloud migration planning (beyond Vercel)

---

## Planning Documents

| Document | Purpose | Status |
|----------|---------|--------|
| **GRAPH_REFACTOR_PLAN.md** | Upgrade Cytoscape.js to live physics-based graph | Ready for implementation |
| **NATIVE_APP_CONVERSION_PLAN.md** | Port InterChord to native macOS/iPadOS/iOS | Planning complete |
| **APPLE_DEV_PERSONA.md** | System prompt for Apple platform development guidance | Reference document |

### Graph Refactor Summary
- **Phase 1:** Enhance existing Cytoscape.js with `cola` layout for live physics
- **Phase 2 (contingency):** Migrate to `react-force-graph` if needed
- Includes art/texture strategy for richer node visuals

### Native App Summary
- Swift + SwiftUI targeting macOS, iPadOS, iOS
- iPhone as "companion" app (no graph, list-based)
- SpriteKit for physics-based graph on iPad/Mac
- Data priority: stonefrog-db01 → local cache → public API

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
- [x] Filter graph by relationship type
- [x] Temporal filtering
- [ ] Discovery results panel
- [ ] "Explore connections" mode

#### Artist Biography & Geography
- [x] Wikidata integration for richer biographical data (spouses, children, etc.)
- [x] Display birth/death dates and locations with age calculation
- [x] Show family info (spouses, children count)
- [x] Wikipedia and official website links
- [x] Interactive map widget with Leaflet/OpenStreetMap (no API key needed)
- [x] Plot birth, death, and residence locations on map
- [x] Travel path polyline connecting locations chronologically
- [x] Color-coded markers (green=birth, red=death, blue=residence)
- [x] Collapsible sidebar section with drag-and-drop reordering

#### User Concert Memories (NEW)
- [ ] Upload concert tickets (photos/scans)
- [ ] Upload photos from shows attended
- [ ] Store concert location on interactive map
- [ ] Record date/time of show
- [ ] Fetch historical weather data for concert date/location
- [ ] User notes field for personal memories
- [ ] Tag friends who attended the concert with you
- [ ] Link to artist via MBID
- [ ] Store in InterChord user database (separate from MusicBrainz)
- [ ] Future: Encryption for user data security (later phase)

#### Concert Integration (Added)
- [x] Setlist.fm API integration for past concerts
- [x] Server-side proxy route to avoid CORS
- [x] Recent shows display in artist detail
- [x] Favorites aggregation showing shows from all favorited artists
- [ ] SeatGeek API for upcoming concerts (waiting for approval)

#### Artist Timeline (Moved up from Future)
- [x] Full-width responsive timeline panel
- [x] Album release visualizations with cover art
- [x] Reactive to browser resize
- [x] Fallback image APIs with proxy routes
- [ ] Member tenure visualization
- [ ] Event filtering (albums only, members only)
- [ ] Festival appearances (Lollapalooza, Lilith Fair, etc.)

#### Media Integration (NEW)
- [ ] Music videos from YouTube
- [ ] Live performance videos
- [ ] Behind-the-scenes footage
- [ ] Audio samples/previews
- [ ] Festival performance recordings

#### Natural Language Search (NEW)
- [ ] Parse complex search queries like "butthole surfers @ 9:30 club in DC"
- [ ] Extract entities: artist, venue, location, date
- [ ] Search across multiple data sources (MusicBrainz, Setlist.fm, user memories)
- [ ] Venue-based discovery: "who played at Red Rocks in 1995"
- [ ] Location-based discovery: "shows in Austin TX 1990-1999"
- [ ] Cross-reference user concert memories with query
- [ ] Fuzzy matching for venue names and locations
- [ ] Date range parsing: "last summer", "in the 90s", "2015"

#### AI-Powered Features (NEW)
- [ ] Intelligent search with LLM parsing for complex queries
- [ ] AI playlist generation based on:
  - [ ] Mood/vibe descriptions ("chill summer evening")
  - [ ] Activity context ("workout music", "road trip")
  - [ ] Artist similarity ("sounds like Radiohead but more upbeat")
  - [ ] Era/decade preferences ("90s alternative deep cuts")
  - [ ] Relationship-based discovery ("artists who influenced Nirvana")
- [ ] Smart recommendations using graph connections + listening patterns
- [ ] Natural language concert search ("shows I might like this weekend")
- [ ] AI-generated artist summaries combining Wikipedia, MusicBrainz, and graph data
- [ ] Conversational interface for music exploration

---

## Upcoming

### Phase 4: MusicBrainz Database Mirror ✅ DEPLOYED
**Status:** Running on stonefrog-db01 (192.168.2.67)

#### Production VM Configuration (stonefrog-db01)

| Resource | Configured | MusicBrainz Recommended | Notes |
|----------|------------|-------------------------|-------|
| **CPU** | 8 cores | 16 threads | Sufficient for mirror + API |
| **RAM** | 16 GB | 16 GB | ✅ Matches recommendation |
| **Disk** | 750 GB | 350 GB | ✅ Exceeds (actual usage ~450GB) |
| **OS** | Rocky Linux 10 | Ubuntu 22.04 | Works fine with Podman |

#### Software Stack (Deployed)
- Podman + Podman Compose (rootless)
- PostgreSQL 16 (containerized)
- Solr 9.7.0 (all 15 search indexes)
- Systemd user services for auto-start

#### Completed Setup
- [x] Create VM in Proxmox (stonefrog-db01)
- [x] Install Podman and Podman Compose
- [x] Clone musicbrainz-docker repository
- [x] Run initial database import
- [x] Set up all 15 Solr search indexes
- [x] Configure hourly replication (cron inside container)
- [x] Create API endpoint (port 5000)
- [x] Update app to use local DB via API routes
- [x] Set up systemd user services for auto-start
- [x] Configure Cloudflare tunnel for HTTPS access
- [ ] Set up live indexing (RabbitMQ + SIR) - IN PROGRESS

#### MusicBrainz Mirror Maintenance

##### Automated Tasks
| Task | Frequency | Method | Status |
|------|-----------|--------|--------|
| DB Replication | Hourly | Container cron | ✅ Configured |
| Solr Live Indexing | Real-time | RabbitMQ + SIR | ⏳ Setting up |

##### Live Indexing Setup (Preferred over Weekly Refresh)
Uses RabbitMQ message queue + SIR (Search Index Rebuilder) for real-time Solr updates.

**Benefits:**
- Steady resource usage (no spiky downloads)
- Search indexes stay within minutes of database
- No weekly 60GB downloads

**Components:**
- RabbitMQ (message queue) - port 5672, web UI 15672
- SIR Indexer (consumes messages, updates Solr)
- PostgreSQL AMQP triggers (notify on data changes)

**Configuration:**
```bash
# Enable live indexing
admin/create-amqp-extension
admin/setup-amqp-triggers install
podman-compose exec indexer python -m sir amqp_setup
admin/configure add live-indexing-search
podman-compose up -d
```

**Key settings (indexer.ini):**
- `import_threads = 8`
- `live_index_batch_size = 100`
- `process_delay = 15` (seconds between batches)

##### Manual Maintenance (Periodic)
| Task | Frequency | Notes |
|------|-----------|-------|
| Check disk space | Monthly | `df -h` - keep >50GB free |
| Check replication health | Monthly | Query `replication_control` table |
| Container updates | Quarterly | `podman pull` new images |
| Schema changes | ~2x/year | Watch MetaBrainz blog, rebuild required |

##### Schema Change Procedure
When MusicBrainz announces schema changes:
1. Replication stops working
2. Pull latest musicbrainz-docker
3. Rebuild containers
4. Re-run: `admin/setup-amqp-triggers uninstall && admin/setup-amqp-triggers install`

#### Actual Disk Usage (Dec 2025)
| Component | Size |
|-----------|------|
| PostgreSQL database | ~80 GB |
| Solr recording index | ~150 GB |
| Solr other indexes (14) | ~50 GB |
| Container images/runtime | ~30 GB |
| OS + working space | ~95 GB |
| **Total Used** | **~405 GB** |
| **Available** | **~345 GB** |

#### Benefits Achieved
- **No rate limits** - instant queries ✅
- **Full relationship data** - all entity types ✅
- **Offline capability** - works without internet ✅
- **Custom queries** - direct SQL access ✅
- **Historical data** - edit history available ✅

#### Solr Index Capabilities

| Index | InterChord Use | Benefit |
|-------|----------------|---------|
| **artist** (2.7M) | Search bar, autocomplete | Find "Beatles" instantly, fuzzy matching |
| **recording** (35M) | Song/track search | "Search for songs by title" feature |
| **release** (3M+) | Album search | Find albums, EPs, singles |
| **work** (1.5M+) | Composition search | Find covers, classical works, songwriting credits |
| **release-group** | Album groupings | Group reissues/editions together |
| **label** | Label search | "Find artists on Sub Pop" |
| **place/area** | Location search | Venues, cities, regions |
| **event** | Concert/festival data | Historical events in MusicBrainz |

**Future Features Enabled:**
- **Track search** - Users search "Stairway to Heaven" and see all covers/versions
- **Similar songs** - Find recordings of the same work (covers, live versions)
- **Label exploration** - "Show me all artists on 4AD Records"
- **Venue history** - "Who played at Red Rocks?" (via place + event indexes)

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

### Future: Apple Music Integration (Web)
- [x] Apple Developer Program enrollment ($99/year) ✅ ENROLLED
- [ ] MusicKit.js integration
- [ ] User authentication flow
- [ ] Library access and analysis
- [ ] Playlist creation/sync
- [ ] Playback integration

### Future: Native App (macOS/iPadOS/iOS)
See **NATIVE_APP_CONVERSION_PLAN.md** for full details.

| Milestone | Description |
|-----------|-------------|
| **M1: Core Foundation** | Xcode project, Swift data models, MusicBrainzClient actor |
| **M2: Basic UI** | Artist search, static detail view, live data |
| **M3: Graph R&D Spike** | SpriteKit prototype for physics-based graph |
| **M4: MVP Integration** | Full graph on iPad/Mac, interactions wired |
| **M5: Polish & Deploy** | iPhone companion UI, App Store submission |

**Key architectural decisions:**
- Data priority: stonefrog-db01 → local cache → public API
- SpriteKit for graph visualization (not WebView)
- iPhone: list-based companion app (no graph)
- ASWebAuthenticationSession for Spotify OAuth
- Keychain for all secrets

### Future: Band Timeline Component (PARTIALLY IMPLEMENTED - See Phase 3)
**Note:** Basic timeline with album visualizations has been implemented in Phase 3. Remaining items:

#### Remaining Timeline Features
- [ ] **Member Changes** - Joins, departures, lineup changes visualization
- [ ] **Pivotal Moments** - Major tours, breakthrough events
- [ ] **Hiatus Periods** - Visual gaps or different styling
- [ ] Sync timeline position with graph selection (click member → highlight tenure)
- [ ] Event filtering (albums only, members only, etc.)

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

## Infrastructure References

### Bare-Metal Kubernetes Ingress Options
Reference: https://kubernetes.github.io/ingress-nginx/deploy/baremetal/

| Approach | Description | Pros | Cons |
|----------|-------------|------|------|
| **MetalLB** | Software load-balancer for bare-metal | Full LoadBalancer support, dedicated IPs | Requires IP pool configuration |
| **NodePort** | NGINX binds to ports 30000-32767 | Simplest default | Source IP lost, non-standard ports |
| **Host Network** | Pods use host's network namespace | Direct 80/443 binding | One pod per node, security concerns |
| **External IPs** | Manual node IP assignment | Simple routing | No source IP preservation, not recommended |
| **Self-Provisioned Edge** | External hardware/software forwards to NodePort | Good for private clusters | Requires additional infrastructure |

**Current Setup:** Cloudflare Tunnel (zero-config, works through NAT)
**Future Consideration:** MetalLB if migrating to Kubernetes cluster

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

### 2025-11-29 to 2025-12-01 (Sessions 6-8)
- **Setlist.fm Integration:**
  - Created `/api/concerts` proxy route to avoid CORS issues
  - Added `useArtistConcerts` and `useMultipleArtistsConcerts` hooks
  - Integrated recent shows into artist detail sidebar
  - Added favorites aggregation showing shows from all favorited artists
- **Artist Timeline Feature (moved up from Future):**
  - Created album visualizations with timeline view
  - Full-width responsive timeline panel
  - Album cover art display with fallback image APIs
  - Proxy routes for Cover Art Archive, MusicBrainz, and iTunes images
- **Graph Enhancements:**
  - Added graph filters for relationship types
  - Added temporal filtering
  - Reduced header space, moved back button to top-left
- **UI Polish:**
  - Enhanced album display with multiple fallback image sources
  - Improved layout and spacing
- Updated Confluence documentation with full project phases
- **Phase 3 Extended Discovery in progress!**

### 2025-12-02 (Session 9) - Code Review & Refactoring
- **Code Review Implementation (Cloud-Readiness Focus):**
  - Reviewed Gemini CLI code review recommendations
  - Prioritized practical improvements for hobby project with future cloud deployment

- **ArtistDetail Component Refactoring:**
  - Extracted graph logic into new `src/lib/graph/` module:
    - `types.ts` - ExpansionDepth, GroupedItem, relationship constants
    - `builder.ts` - Pure functions for graph building/merging
    - `hooks.ts` - useGraphExpansion custom hook
  - Reduced artist-detail.tsx from ~800 lines to ~393 lines
  - Moved UI state (selectedNodeId, hoveredArtistId) back to component
  - Business logic (graph expansion, relationship grouping) now in dedicated module

- **Favorites Module Cleanup:**
  - Created `src/lib/favorites/utils.ts` with standalone utility functions
  - Updated imports across components to use `@/lib/favorites`
  - Fixed cross-component import smell (was importing from artist-search.tsx)

- **MusicBrainz Client Tests:**
  - Created `src/lib/musicbrainz/client.test.ts` with 13 tests
  - Tests cover: response parsing, request format, error handling, queue behavior
  - Fixed timing issues with rate limiter's module-level state

- **Bug Fixes:**
  - Fixed "Clear All Favorites" re-importing from Spotify (was clearing SPOTIFY_IMPORTED flag)
  - Fixed Spotify OAuth callback not processing when dropdown closed (SpotifyAuth now always mounted)
  - Added polling fallback for favorites updates during Spotify imports
  - Fixed concerts hooks test (updated for new mbid parameter)

- **Test Coverage:** 51 tests passing across 5 test files

---

## Quick Resume

**Next task:** Continue Phase 3 - Extended Discovery

**Immediate priorities:**
1. Complete Artist Timeline (member tenure visualization)
2. Add Artist-Recording relationships (guest appearances, producers)
3. Add Artist-Label relationships (labelmates)
4. Build discovery algorithms (side projects, collaborator chains)

**Future priority (after basic discovery):**
- Phase 4: MusicBrainz Database Mirror in Proxmox VM (eliminates rate limits!)

**Key files:**
- `CLAUDE.md` - Project specification and guidelines
- `PROGRESS.md` - This file (keep updated!)
- `GRAPH_REFACTOR_PLAN.md` - Live physics graph upgrade plan
- `NATIVE_APP_CONVERSION_PLAN.md` - Native macOS/iPadOS/iOS port plan
- `APPLE_DEV_PERSONA.md` - System prompt for Apple development guidance
- `music-api-discovery.md` - API integration reference
- `src/lib/musicbrainz/client.ts` - MusicBrainz API client with rate limiting
- `src/lib/musicbrainz/hooks.ts` - TanStack Query hooks
- `src/lib/musicbrainz/client.test.ts` - MusicBrainz client tests
- `src/lib/graph/` - Graph logic (builder, hooks, types) - **NEW**
- `src/lib/favorites/` - Favorites management (hooks, utils) - **UPDATED**
- `src/lib/concerts/` - Setlist.fm client and hooks
- `src/components/artist-search.tsx` - Search interface
- `src/components/artist-detail.tsx` - Artist detail with List/Graph toggle (refactored)
- `src/components/settings-dropdown.tsx` - Settings with Spotify/Apple Music auth
- `src/components/graph/artist-graph.tsx` - Cytoscape.js wrapper
- `src/components/graph/index.tsx` - GraphView with controls
- `src/app/api/concerts/route.ts` - Setlist.fm proxy API
- `src/app/api/images/` - Album artwork proxy routes
- `src/types/index.ts` - TypeScript definitions

**To test:** `pnpm dev` then open http://localhost:3000
- Search for "Butthole Surfers"
- Click on result to see band members with Founding/Current badges
- Toggle between **List** and **Graph** views
- In List view: Members sorted with Founding/Current badges and tenure years
- In Graph view: Interactive node graph with band as center, members as connected nodes
- **NEW:** View artist timeline with album visualizations
- **NEW:** See recent shows from Setlist.fm in the detail sidebar
- **NEW:** Filter graph by relationship type and time period
- Double-click on a member node to expand their relationships
- Click on any artist to navigate to their detail page
- Add artists to favorites and see aggregated recent shows on home page

**MusicBrainz VM Quick Setup (Phase 4):**
```bash
# On Proxmox: Create Ubuntu 22.04 VM (16 threads, 16GB RAM, 350GB SSD)
git clone https://github.com/metabrainz/musicbrainz-docker.git
cd musicbrainz-docker
docker compose build
docker compose run --rm musicbrainz createdb.sh -fetch  # ~4-6 hours
docker compose up -d
```
