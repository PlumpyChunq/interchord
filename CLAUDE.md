# InterChord - The Music Web

> **Last Updated:** 2025-12-04 | **Current Phase:** 3 - Extended Discovery

## Quick Reference

```bash
# Development
pnpm dev          # Start dev server at http://localhost:3000
pnpm build        # Production build
pnpm lint         # Run ESLint
pnpm test         # Run tests in watch mode
pnpm test:run     # Run tests once
```

## Multi-Claude Coordination System

**IMPORTANT:** This project uses multiple Claude instances that coordinate via git.

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

### During Session - Check Periodically:
- **Every few messages**, do a quick sync: `git fetch origin && git diff HEAD origin/main -- .claude/handoff/`
- If changes detected, `git pull` and read the other Claude's status
- After completing significant work, update your handoff file and push

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

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 16)                         │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐   │
│  │   Artist Search     │  │   Interactive Graph Visualizer  │   │
│  │   + Favorites       │  │   (Cytoscape.js)                │   │
│  └─────────────────────┘  └─────────────────────────────────┘   │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐   │
│  │   Recent Shows      │  │   Artist Detail Sidebar         │   │
│  │   (Setlist.fm)      │  │   (Members, Shows, Links)       │   │
│  └─────────────────────┘  └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js API Routes                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │   /api/concerts (Setlist.fm proxy - avoids CORS)        │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        ▼                                           ▼
┌───────────────────────┐               ┌───────────────────────┐
│     MusicBrainz       │               │     Setlist.fm        │
│  (artist relations)   │               │   (past concerts)     │
│   1 req/sec limit     │               │    via API route      │
└───────────────────────┘               └───────────────────────┘
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
| MusicBrainz | Artist relationships | User-Agent header | **1 req/sec limit** - implemented with queue |
| Setlist.fm | Past concerts | API key in `.env.local` | Server-side proxy to avoid CORS |
| Songkick | Upcoming tour dates | None (search links only) | No API - links to search pages |
| SeatGeek | Upcoming concerts | Pending approval | Will replace Songkick links |

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

## Environment Variables

```env
# .env.local (required)
SETLIST_FM_API_KEY=your_api_key_here
```

## Coding Conventions

- **'use client'** directive on all components using hooks or browser APIs
- **TypeScript strict mode** - no `any`, explicit types
- **shadcn/ui** for UI components in `src/components/ui/`
- **TanStack Query** for server state (caching, loading, refetching)
- **localStorage** for favorites and cached data (with TTL via `src/lib/cache`)

## Known Limitations

1. **Setlist.fm only provides past shows** - No future concert dates. Songkick search links are a workaround until SeatGeek API is approved.

2. **MusicBrainz rate limit** - 1 request/second. The client queues requests automatically, but large graphs take time to load.

3. **No database** - All data is fetched fresh or cached in localStorage. No user accounts.

4. **Force layout is static** - COSE calculates positions once; no real-time physics when dragging nodes.

## Future Improvements

See `PROGRESS.md` for the complete roadmap (Phases 3-7). Key upcoming items:

- [ ] SeatGeek API integration for upcoming concerts (waiting for approval)
- [ ] Real-time force layout with d3-force
- [ ] MusicBrainz database mirror (eliminates rate limits)
- [ ] Apple Music integration ($99/year developer program)
- [ ] PostgreSQL for persistent favorites/user data

## Development Notes

- Use Playwright MCP for browser testing when needed
- Confluence documentation: [InterChord Project](https://stonefrog.atlassian.net/wiki/spaces/STONEFROG/pages/1936752642)
- You are a senior engineer doing a code review for a service that will eventually run in the cloud and scale horizontally.
I’ll provide you this project’s files.

Goals:
    •    Easy maintenance and onboarding
    •    Easy to add new features
    •    Cloud-ready and scalable (stateless where appropriate, config via env, no hidden local assumptions)

Please:
    1.    Give a quick overview of the architecture and folder structure.
    2.    Call out any design smells (tight coupling, god classes, cross-cutting concerns leaking everywhere).
    3.    Check that configuration, logging, and error handling follow best practices for cloud deployment.
    4.    Check for test coverage strategy and how easy it is to test units in isolation.
    5.    Recommend concrete refactors and show small, focused code examples (before/after) where useful.
    6.    Suggest how to better organize modules so that adding new features is straightforward.

Assume I’ll eventually run this as Docker containers behind a load balancer in <cloud/Kubernetes/etc.>.
- the /tmp/ dir is wharer Claude 1 and Claude 2 will Communicat
- the /tmp/ dir is wharer Claude 1 and Claude 2 will Communicate