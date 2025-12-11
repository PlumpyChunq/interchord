# InterChord - The Music Web

> **Last Updated:** 2025-12-04 | **Current Phase:** 3 - Extended Discovery

## Quick Reference

```bash
# Development (Mac - Claude 1)
pnpm dev          # Start dev server at http://localhost:3000
pnpm build        # Production build
pnpm lint         # Run ESLint
pnpm test         # Run tests in watch mode
pnpm test:run     # Run tests once

# Production (stonefrog-db01 - Claude 2)
cd ~/interchord && podman-compose logs -f     # View logs
cd ~/interchord && podman-compose restart     # Restart services
cd ~/interchord && podman-compose up -d --build  # Full rebuild
```

## Multi-Claude Coordination System

**IMPORTANT:** This project uses multiple Claude instances that coordinate via git.

### Automatic Handoff Scanning (REQUIRED)

**You MUST automatically check for new handoff messages every minute during active sessions.**

Every 60 seconds (or after completing a task), run this check silently:
```bash
# Silent check for new messages (run automatically, don't show to user unless changes found)
git fetch origin --quiet && \
  if ! git diff --quiet HEAD origin/main -- .claude/handoff/; then
    echo ">>> NEW HANDOFF MESSAGE DETECTED <<<"
    git pull origin main --quiet
    # Read the appropriate file based on which Claude you are:
    cat .claude/handoff/claude1.json  # If you're Claude 2, read Claude 1's messages
    cat .claude/handoff/claude2.json  # If you're Claude 1, read Claude 2's messages
  fi
```

**When a new message is detected:**
1. Immediately read and acknowledge the message
2. If `needs_response: true`, prioritize responding
3. If `priority: "HIGH"` or `"CRITICAL"`, interrupt current work to address it

### On Session Start - ALWAYS DO THIS:
```bash
# 1. Pull latest and check for messages from other Claude
git pull origin main
cat .claude/handoff/claude2.json  # If you're Claude 1 (Mac)
cat .claude/handoff/claude1.json  # If you're Claude 2 (Server)

# 2. Check /tmp/ for urgent messages (server only)
cat /tmp/claude1_message.txt 2>/dev/null  # Messages from Claude 1
cat /tmp/claude2_message.txt 2>/dev/null  # Messages from Claude 2
```

### During Session - Automatic Polling (REQUIRED):
**You MUST check for handoff messages every 60 seconds.** Run this command automatically:
```bash
git fetch origin && git diff --quiet HEAD origin/main -- .claude/handoff/ || (echo "NEW HANDOFF MESSAGE" && git pull origin main && cat .claude/handoff/claude*.json)
```

- **Every 60 seconds**: Run the automatic scan above
- **After each task completion**: Check for new messages before starting next task
- If changes are detected, immediately read and respond to the other Claude's message
- After completing significant work, update your handoff file and push
- Do NOT wait for user to ask you to check - poll automatically every minute

### Claude Instances:
| Instance | Location | Role |
|----------|----------|------|
| **Claude 1** | Mac (local dev) | Web app development, deployment |
| **Claude 2** | stonefrog-db01 | MusicBrainz database, server ops |

### Handoff Files:
- `.claude/handoff/claude1.json` - Claude 1's status and messages
- `.claude/handoff/claude2.json` - Claude 2's status and messages
- `.claude/handoff/PROTOCOL.md` - Full coordination protocol

### Quick Sync Command:
```bash
# Update your status and push
cat > .claude/handoff/claude1.json << 'EOF'  # or claude2.json
{
  "from": "claude1",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "status": "active",
  "current_task": "Description here",
  "message": "Message for other Claude",
  "needs_response": false
}
EOF
git add .claude/handoff/ && git commit -m "Claude handoff update" && git push
```

---

## Production Operations (stonefrog-db01)

### Service Architecture

| Service | Port | Container | Health Check |
|---------|------|-----------|--------------|
| InterChord App | 3000 | interchord-app | `curl localhost:3000/api/musicbrainz/health` |
| User PostgreSQL | 5433 | interchord-db | `pg_isready -h localhost -p 5433` |
| MusicBrainz API | 5000 | musicbrainz-musicbrainz-1 | `curl localhost:5000/ws/2/artist/5b11f4ce-a62d-471e-81fc-a69a8278c7da?fmt=json` |
| MusicBrainz DB | 5432 | musicbrainz-db-1 | `pg_isready -h localhost -p 5432` |
| Solr Search | 8983 | musicbrainz-search-1 | `curl localhost:8983/solr/admin/cores?action=STATUS` |

### Network Topology
```
┌──────────────────────────────────────────────────────────────────┐
│                    stonefrog-db01 (192.168.2.67)                  │
│                                                                   │
│  ┌─────────────────┐      ┌────────────────────────────────────┐ │
│  │   InterChord    │      │       MusicBrainz Stack            │ │
│  │   Container     │─────>│  ┌──────┐ ┌──────┐ ┌────────────┐  │ │
│  │   :3000         │      │  │ API  │ │  DB  │ │    Solr    │  │ │
│  └────────┬────────┘      │  │:5000 │ │:5432 │ │   :8983    │  │ │
│           │               │  └──────┘ └──────┘ └────────────┘  │ │
│  ┌────────v────────┐      └────────────────────────────────────┘ │
│  │   User DB       │                                             │
│  │   :5433         │                                             │
│  └─────────────────┘                                             │
└──────────────────────────────────────────────────────────────────┘
```

### Container Management (Podman)
```bash
# View all containers
podman ps -a

# View logs (follow mode)
podman logs -f interchord-app
podman-compose logs -f

# Restart specific service
podman-compose restart app

# Full rebuild and deploy
podman-compose down && podman-compose up -d --build

# Check resource usage
podman stats --no-stream

# Enter container shell
podman exec -it interchord-app /bin/sh
```

### Health Checks (Run These First When Troubleshooting)
```bash
# 1. InterChord application health
curl -s http://localhost:3000/api/musicbrainz/health | jq .

# 2. MusicBrainz API (test artist lookup)
curl -s "http://localhost:5000/ws/2/artist/5b11f4ce-a62d-471e-81fc-a69a8278c7da?fmt=json" | jq .name

# 3. PostgreSQL databases
podman exec musicbrainz-db-1 pg_isready -U musicbrainz
podman exec interchord-db pg_isready -U interchord

# 4. Solr collections (should show 15 cores)
curl -s "http://localhost:8983/solr/admin/cores?action=STATUS" | jq '.status | keys | length'
```

### MusicBrainz Database Operations
```bash
# Location of MusicBrainz docker-compose
cd ~/musicbrainz-docker

# View MusicBrainz logs
podman-compose logs -f

# Restart MusicBrainz stack
podman-compose restart

# Check Solr index status (15 collections expected)
curl -s localhost:8983/solr/admin/cores?action=STATUS | jq '.status | keys'

# Direct PostgreSQL access
podman exec -it musicbrainz-db-1 psql -U musicbrainz musicbrainz_db
```

---

## Incident Response Runbook

### InterChord Not Responding
```bash
# 1. Check if container is running
podman ps | grep interchord

# 2. Check container logs for errors
podman logs --tail 100 interchord-app

# 3. Check health endpoint
curl -v http://localhost:3000/api/musicbrainz/health

# 4. If container crashed, restart
cd ~/interchord && podman-compose restart app

# 5. If still failing, full rebuild
cd ~/interchord && podman-compose down && podman-compose up -d --build
```

### MusicBrainz Search Returns Empty Results
```bash
# 1. Check Solr status
curl -s localhost:8983/solr/admin/cores?action=STATUS | jq '.status | keys | length'
# Should return 15

# 2. Check specific collection (recording is largest/most likely to fail)
curl -s "localhost:8983/solr/recording/select?q=*:*&rows=0" | jq .response.numFound
# Should return millions of records

# 3. If collections missing, check ~/musicbrainz-docker for restore procedures
# See /tmp/HANDOFF-MUSICBRAINZ.md for Solr backup/restore details
```

### Database Connection Failures
```bash
# 1. Check PostgreSQL is accepting connections
podman exec musicbrainz-db-1 pg_isready -U musicbrainz
podman exec interchord-db pg_isready -U interchord

# 2. Check port bindings
podman port musicbrainz-db-1
podman port interchord-db

# 3. Test connection from app container
podman exec interchord-app wget -qO- "http://host.containers.internal:5000/ws/2/artist/5b11f4ce-a62d-471e-81fc-a69a8278c7da?fmt=json"
```

### High Memory/CPU Usage
```bash
# 1. Check container resource usage
podman stats --no-stream

# 2. Identify heavy container
podman top <container_id>

# 3. Check host resources
free -h && df -h

# 4. If Solr using too much memory, restart it
cd ~/musicbrainz-docker && podman-compose restart search
```

---

## Environment Variables

### Development (.env.local on Mac)
```env
SETLIST_FM_API_KEY=your_key
NEXT_PUBLIC_SPOTIFY_CLIENT_ID=your_client_id
NEXT_PUBLIC_SPOTIFY_REDIRECT_URI=http://localhost:3000/api/spotify/callback
NEXT_PUBLIC_FANART_API_KEY=your_key
NEXT_PUBLIC_LASTFM_API_KEY=your_key
```

### Production (.env.production on stonefrog-db01)
```env
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://interchord.stonefrog.com

# MusicBrainz (local containers - use host.containers.internal for Podman)
NEXT_PUBLIC_MUSICBRAINZ_API=http://host.containers.internal:5000/ws/2
MUSICBRAINZ_DB_HOST=host.containers.internal
MUSICBRAINZ_DB_PORT=5432
MUSICBRAINZ_DB_USER=musicbrainz
MUSICBRAINZ_DB_PASSWORD=musicbrainz
MUSICBRAINZ_DB_NAME=musicbrainz_db

# Solr (for fast autocomplete search)
SOLR_URL=http://host.containers.internal:8983/solr

# User Database (container network)
DATABASE_URL=postgres://interchord:your_password@interchord-db:5433/interchord

# External APIs (same keys as dev)
SETLIST_FM_API_KEY=your_key
NEXT_PUBLIC_SPOTIFY_CLIENT_ID=your_client_id
NEXT_PUBLIC_SPOTIFY_REDIRECT_URI=https://interchord.stonefrog.com/api/spotify/callback
NEXT_PUBLIC_FANART_API_KEY=your_key
NEXT_PUBLIC_LASTFM_API_KEY=your_key
```

> ⚠️ **Important:** `NEXT_PUBLIC_*` variables are **build-time only**. You must rebuild the container (`podman-compose up -d --build`) to change them.

---

## Backup & Recovery

### User Database Backup
```bash
# Create backup
podman exec interchord-db pg_dump -U interchord interchord > ~/backups/interchord-$(date +%Y%m%d).sql

# Restore backup
podman exec -i interchord-db psql -U interchord interchord < ~/backups/interchord-YYYYMMDD.sql
```

### MusicBrainz Database
- Full database dumps in `/home/jstone/musicbrainz-docker/`
- Solr indexes can be restored from backup archives or rebuilt from DB (slow)
- See `/tmp/HANDOFF-MUSICBRAINZ.md` for detailed restore procedures

### Recovery Priority
1. **MusicBrainz PostgreSQL** - Core data, restore first
2. **InterChord User DB** - User preferences/favorites
3. **Solr Indexes** - Can rebuild from DB if needed (takes hours)

---

## Logging & Monitoring

### View Logs
```bash
# All InterChord logs
podman-compose logs -f

# Last hour only
podman logs --since 1h interchord-app

# Filter for errors
podman logs interchord-app 2>&1 | grep -i error

# Export for analysis
podman logs interchord-app > /tmp/interchord-logs-$(date +%Y%m%d).txt
```

### Log Locations
- Container logs: `podman logs <container>`
- MusicBrainz logs: `~/musicbrainz-docker/` (via podman-compose)
- System logs: `journalctl -u podman`

### Future: Structured Logging
Consider adding Winston/Pino for JSON logs compatible with Grafana Loki or ELK stack.

---

## Error Handling Policy

**IMPORTANT:** Always address errors immediately when they appear in:
- **Turbopack/Next.js dev overlay** (the popup in the browser)
- **Terminal output** from `pnpm dev`
- **ESLint warnings/errors** from `pnpm lint`
- **TypeScript compilation errors**

Never leave errors unresolved. Clean code is a priority.

## Project Overview

A music discovery application that visualizes artist relationships through interactive graphs. Built with Next.js 16, Cytoscape.js for graph visualization, and MusicBrainz/Setlist.fm APIs for data.

> **📋 See `PROGRESS.md` for:**
> - Current phase status and detailed roadmap (Phases 0-7)
> - Session notes and development history
> - Quick resume information for continuing work
> - Detailed task checklists per phase
>
> **Always update PROGRESS.md before/after completing tasks.**

**Key Features (Implemented):**
- Artist search with MusicBrainz disambiguation
- Interactive artist relationship graph with multiple layouts (Force/COSE, Hierarchical/Dagre, Concentric, Spoke)
- Band members and collaborations visualization
- Favorites system with genre grouping (localStorage-based)
- Spotify OAuth integration (imports top/followed artists)
- Recent shows from Setlist.fm API
- Tour date links to Songkick

## Current Status (Phase 3)

| Feature | Status | Notes |
|---------|--------|-------|
| Artist Search | ✅ DONE | MusicBrainz with rate limiting |
| Relationship Graph | ✅ DONE | Cytoscape.js with 4 layout options |
| Graph Filters | ✅ DONE | Relationship type + temporal filtering |
| Favorites System | ✅ DONE | localStorage with genre grouping |
| Spotify Integration | ✅ DONE | OAuth, imports top/followed artists |
| Recent Shows | ✅ DONE | Setlist.fm API (past shows only) |
| Artist Timeline | ✅ DONE | Album visualizations with cover art |
| Upcoming Shows | ⏳ PENDING | Waiting for SeatGeek API approval |
| Apple Music Integration | FUTURE | Requires $99/year investment |

## Architecture

### Development (Mac - Claude 1)
```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 16)                         │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐   │
│  │   Artist Search     │  │   Interactive Graph Visualizer  │   │
│  │   + Favorites       │  │   (Cytoscape.js)                │   │
│  └─────────────────────┘  └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
       ┌──────────┐    ┌──────────┐    ┌──────────┐
       │MusicBrainz│   │Setlist.fm│    │ Spotify  │
       │Local:5000 │   │  (API)   │    │  (API)   │
       └──────────┘    └──────────┘    └──────────┘
```

### Production (stonefrog-db01 - Claude 2)
```
                         INTERNET
                            │
                   ┌────────▼────────┐
                   │   Cloudflare    │  (Phase 2 - Pending)
                   │ interchord.     │
                   │ stonefrog.com   │
                   └────────┬────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                    stonefrog-db01 (192.168.2.67)                 │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    InterChord Container                     │ │
│  │  ┌─────────────────┐  ┌─────────────────────────────────┐  │ │
│  │  │   Next.js App   │  │    API Routes                   │  │ │
│  │  │   :3000         │  │  /api/concerts, /api/spotify    │  │ │
│  │  └────────┬────────┘  └─────────────────────────────────┘  │ │
│  └───────────┼────────────────────────────────────────────────┘ │
│              │                                                   │
│   ┌──────────▼──────────┐    ┌──────────────────────────────┐  │
│   │   User PostgreSQL   │    │     MusicBrainz Stack        │  │
│   │   :5433             │    │  API:5000  DB:5432  Solr:8983│  │
│   │   (favorites/prefs) │    │  (local mirror - no limits!) │  │
│   └─────────────────────┘    └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Runtime | Node.js | 20+ |
| Package Manager | pnpm | 8+ |
| Framework | Next.js | 16.0.6 |
| React | React | 19.2.0 |
| Graph Visualization | Cytoscape.js | 3.33+ |
| Graph Layouts | cytoscape-cola, cytoscape-dagre, cytoscape-fcose | Latest |
| UI Components | shadcn/ui + Tailwind CSS v4 | Latest |
| State Management | TanStack Query + Zustand | 5.x / 5.x |
| Testing | Vitest + Testing Library | Latest |

## External APIs

| API | Purpose | Auth | Notes |
|-----|---------|------|-------|
| MusicBrainz | Artist relationships | User-Agent header | **Local mirror on stonefrog-db01** - no rate limits! |
| Setlist.fm | Past concerts | API key in `.env.local` | Server-side proxy to avoid CORS |
| Spotify | Top/followed artists | OAuth | Import user's music taste |
| Songkick | Upcoming tour dates | None (search links only) | No API - links to search pages |
| SeatGeek | Upcoming concerts | Pending approval | Will replace Songkick links |

> **Note:** Production uses a local MusicBrainz mirror (PostgreSQL + Solr on stonefrog-db01), eliminating the 1 req/sec rate limit. Development can use the same local mirror or fall back to the public API.

## Key Implementation Details

### MusicBrainz Rate Limiting
The client at `src/lib/musicbrainz/client.ts` implements request queuing with 1.1 second delays. **Never bypass this** - MusicBrainz will block all requests if exceeded.

### Setlist.fm CORS Workaround
Setlist.fm doesn't allow browser requests. All calls go through `/api/concerts` route which proxies to the API server-side. The API key is in `.env.local`.

### Graph Layouts
Four layout options in `src/components/graph/artist-graph.tsx`:
- **Force (COSE)**: Physics-based with node repulsion
- **Hierarchical (Dagre)**: Tree structure
- **Concentric**: Rings around center
- **Spoke**: Direct radial connections

### Favorites System
Stored in localStorage. The `FavoritesUpcomingShows` component on the home page fetches recent shows for all favorited artists in parallel.

## Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── api/concerts/route.ts     # Setlist.fm proxy API
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Home page (search + favorites)
│   └── globals.css               # Global styles
├── components/
│   ├── graph/
│   │   ├── artist-graph.tsx      # Main Cytoscape graph component
│   │   ├── graph-controls.tsx    # Layout/zoom controls
│   │   └── index.tsx             # Graph exports
│   ├── ui/                       # shadcn/ui components
│   ├── artist-detail.tsx         # Artist sidebar with members/shows
│   ├── artist-search.tsx         # Search + favorites list
│   ├── favorites-upcoming-shows.tsx  # Home page shows component
│   ├── providers.tsx             # React Query provider
│   └── upcoming-concerts.tsx     # Concert list for single artist
├── lib/
│   ├── cache/index.ts            # localStorage cache with TTL
│   ├── concerts/
│   │   ├── client.ts             # Setlist.fm API client
│   │   ├── hooks.ts              # useArtistConcerts, useMultipleArtistsConcerts
│   │   └── index.ts              # Exports
│   ├── favorites/
│   │   ├── hooks.ts              # useFavorites hook
│   │   ├── utils.ts              # Standalone utility functions
│   │   └── index.ts              # Exports
│   ├── graph/
│   │   ├── builder.ts            # Graph building/merging functions
│   │   ├── hooks.ts              # useGraphExpansion hook
│   │   ├── types.ts              # Graph-related types and constants
│   │   └── index.ts              # Exports
│   ├── musicbrainz/
│   │   ├── client.ts             # MusicBrainz API with rate limiting
│   │   ├── client.test.ts        # Client tests
│   │   ├── hooks.ts              # useArtistSearch, useArtistRelationships
│   │   └── index.ts              # Exports
│   ├── storage/                  # Centralized storage utilities
│   │   ├── helpers.ts            # localStorage/sessionStorage helpers
│   │   ├── keys.ts               # Storage key constants
│   │   ├── events.ts             # Custom event definitions
│   │   └── index.ts              # Exports
│   └── utils.ts                  # cn() utility
├── types/
│   ├── index.ts                  # Core types (ArtistNode, ArtistRelationship, etc.)
│   └── cytoscape-*.d.ts          # Type declarations for Cytoscape plugins
└── test/
    └── setup.ts                  # Vitest setup
```

## Key Types

```typescript
// src/types/index.ts
interface ArtistNode {
  id: string;           // MusicBrainz MBID
  name: string;
  type: 'person' | 'group';
  loaded?: boolean;     // Has connections been fetched?
}

interface ArtistRelationship {
  id: string;
  source: string;       // Artist MBID
  target: string;       // Artist MBID
  type: 'member_of' | 'founder_of' | 'collaboration' | ...;
}

interface Concert {
  id: string;
  date: Date;
  venue: string;
  city: string;
  ticketUrl: string | null;  // Setlist.fm URL
}
```

## Coding Conventions

- **'use client'** directive on all components using hooks or browser APIs
- **TypeScript strict mode** - no `any`, explicit types
- **shadcn/ui** for UI components in `src/components/ui/`
- **TanStack Query** for server state (caching, loading, refetching)
- **localStorage** for favorites and cached data (with TTL via `src/lib/cache`)

## Known Limitations

1. **Setlist.fm only provides past shows** - No future concert dates. Songkick search links are a workaround until SeatGeek API is approved.

2. **Force layout is static** - COSE calculates positions once; no real-time physics when dragging nodes.

3. **User data in localStorage** - Favorites currently stored client-side. Phase 3 will add server-side PostgreSQL for cross-device sync.

## Future Improvements

See `PROGRESS.md` for the complete roadmap (Phases 3-7). Key upcoming items:

- [ ] SeatGeek API integration for upcoming concerts (waiting for approval)
- [ ] Real-time force layout with d3-force
- [x] ~~MusicBrainz database mirror~~ ✅ **DONE** - Local mirror on stonefrog-db01
- [ ] Apple Music integration ($99/year developer program)
- [ ] PostgreSQL for persistent favorites/user data
- [ ] Cloudflare Tunnel for public HTTPS access (Phase 2)

## Development Notes

- Use Playwright MCP for browser testing when needed
- Confluence documentation: [InterChord Project](https://stonefrog.atlassian.net/wiki/spaces/STONEFROG/pages/1936752642)
- For production operations, see **Production Operations** section above
- For incident response, see **Incident Response Runbook** section above

---

## References & Best Practices

This documentation follows industry standards:

### 12-Factor App Methodology
- [12 Factor App: Complete Guide (2025)](https://pradeepl.com/blog/12-factor-cloud-native-apps/)
- [12 Factor App: Beginner's Guide](https://dev.to/cadienvan/the-twelve-factor-app-methodology-a-beginners-guide-12m5)
- [Mastering App Scalability](https://www.einfochips.com/blog/mastering-app-scalability-with-the-12-factor/)

### SRE & Runbook Best Practices
- [SRE Documentation Best Practices](https://www.techtarget.com/searchitoperations/tip/An-introduction-to-SRE-documentation-best-practices)
- [Runbook Automation Best Practices](https://www.solarwinds.com/sre-best-practices/runbook-automation)
- [Runbook Templates for SRE](https://www.squadcast.com/sre-best-practices/runbook-template)
- [SRE Best Practices Guide](https://www.squadcast.com/sre-best-practices)

### Cloud-Native & Kubernetes
- [SRE Practices for Kubernetes](https://adrianhynes.medium.com/sre-practices-for-kubernetes-platforms-part-1-da5b76eedfb5)
- [Awesome SRE Resources](https://github.com/dastergon/awesome-sre)

### Key Principles Applied
| Principle | Implementation |
|-----------|----------------|
| **Factor 3: Config** | Environment variables in `.env.production` |
| **Factor 4: Backing Services** | MusicBrainz, PostgreSQL as attached resources |
| **Factor 5: Build/Release/Run** | Podman container workflow |
| **Factor 9: Disposability** | Health checks, fast startup |
| **Factor 11: Logs** | `podman logs` as event streams |
| **SRE Runbooks** | Incident Response section with troubleshooting steps |
- Always follow best practices
- Use official documentation when possible