# InterChord Native App Migration Plan

> **Version 2.0** | **Last Updated:** 2025-12-10
>
> A step-by-step plan to port InterChord from Next.js to native Swift/SwiftUI.

## Current State

| Component | Web App (Current) | Native App (Target) |
|-----------|-------------------|---------------------|
| UI Framework | React + Next.js | SwiftUI |
| Graph Viz | Cytoscape.js | SpriteKit |
| State | TanStack Query + Zustand | @Observable + SwiftData |
| API Client | TypeScript fetch | URLSession actor |
| Platforms | Browser | macOS, iPadOS, iOS |

---

## Phase 1: Foundation

**Goal:** Xcode project compiles, fetches data from stonefrog-db01, displays search results.

**Exit Criteria:**
- [ ] App launches on macOS and iOS Simulator
- [ ] Search "Beatles" returns results from stonefrog-db01
- [ ] Falls back to public API if server unreachable
- [ ] Unit tests pass

### Tasks

- [ ] Create Xcode project (multiplatform: macOS, iOS)
- [ ] Define Swift models: `Artist`, `Relationship`, `Concert`
- [ ] Implement `MusicBrainzClient` actor with data source priority
- [ ] Implement basic `ArtistSearchView` with `TextField`
- [ ] Display search results in a `List`
- [ ] Write unit tests for `MusicBrainzClient`

---

## Phase 2: Core UI

**Goal:** Full artist detail view with relationships, albums, and concerts.

**Exit Criteria:**
- [ ] Can navigate Search → Artist → Related Artist
- [ ] Relationships display with correct grouping
- [ ] Favorites persist across app launches
- [ ] Works offline for cached artists

### Tasks

- [ ] Implement `ArtistDetailView` (biography, members, albums)
- [ ] Implement `RelationshipListView` (grouped by type)
- [ ] Add navigation: Search → Detail → Related Artist
- [ ] Implement `SetlistFMClient` for concert data
- [ ] Add image loading with fallback chain (Fanart → CAA → placeholder)
- [ ] Implement favorites with SwiftData persistence

---

## Phase 3: Graph R&D Spike

**Goal:** Validate SpriteKit can render an interactive force-directed graph.

**Exit Criteria:**
- [ ] Nodes spread out via physics simulation
- [ ] Dragging a node causes others to react
- [ ] Performance acceptable with 50 nodes
- [ ] Decision recorded: Proceed with SpriteKit or pivot?

### Tasks

- [ ] Create standalone `GraphScene` (SKScene subclass)
- [ ] Render 10-20 nodes as `SKSpriteNode`
- [ ] Render edges as `SKShapeNode` lines
- [ ] Implement physics: `SKPhysicsWorld` with repulsion fields
- [ ] Implement drag interaction (lock node during drag)
- [ ] Wrap in SwiftUI via `SpriteView`

---

## Phase 4: Graph Integration

**Goal:** Integrate graph into main app for iPad and macOS.

**Exit Criteria:**
- [ ] Graph displays artist relationships from API
- [ ] Double-tap expands artist's connections
- [ ] Graph hidden on iPhone, visible on iPad/Mac
- [ ] No crashes with 100+ nodes

### Tasks

- [ ] Wire `GraphScene` to real artist data
- [ ] Implement node tap → select, double-tap → expand
- [ ] Implement zoom (pinch on iPad, scroll on Mac)
- [ ] Add node styling: images, selection glow, expanded indicator
- [ ] Add edge styling by relationship type
- [ ] Hide graph on iPhone (show list-only UI)

---

## Phase 5: Polish & Ship

**Goal:** Production-ready app with full platform support.

**Exit Criteria:**
- [ ] All accessibility audits pass
- [ ] TestFlight build approved
- [ ] App Store submission accepted

### Tasks

- [ ] Implement iPhone companion UI (list-based, no graph)
- [ ] Add Spotify OAuth import
- [ ] Add Settings view (data source toggle, cache clear)
- [ ] Implement full accessibility (VoiceOver, Dynamic Type)
- [ ] Add Mac menu bar and keyboard shortcuts
- [ ] Write UI tests for critical flows
- [ ] Create App Store screenshots and metadata
- [ ] Submit to TestFlight, then App Store

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **SpriteKit graph doesn't feel right** | High | Phase 3 is a spike. Pivot to 3rd-party lib or WebView escape hatch. |
| **stonefrog-db01 unreachable** | Medium | Always fall back to public API with rate limiting. |
| **SwiftData limitations** | Low | Core Data is a proven fallback. |
| **App Store rejection** | Medium | Follow HIG strictly. No private APIs. |
| **Scope creep** | Medium | Each phase has explicit exit criteria. Don't proceed without meeting them. |

---

## Data Source Priority

1. **stonefrog-db01** (via Cloudflare tunnel) – No rate limit
2. **Local SwiftData cache** – Offline support
3. **Public MusicBrainz API** – 1 req/sec fallback

---

## Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Language** | Swift 6 | Modern, safe, performant |
| **UI** | SwiftUI | Declarative, multiplatform |
| **Architecture** | MVVM | Clean separation, testable |
| **Concurrency** | Swift Concurrency | `async`/`await`, `actor` for rate limiting |
| **Persistence** | SwiftData | Modern, Swifty persistence |
| **Networking** | URLSession | Standard, powerful |
| **Auth** | ASWebAuthenticationSession | Secure OAuth |
| **Secrets** | Keychain | Secure storage |
| **Graph Data** | Swift-Graph | In-memory graph structure |
| **Graph Viz** | SpriteKit | Native physics engine |

---

## Architecture Reference

```
InterChord/
├── Models/
│   ├── Artist.swift
│   ├── Relationship.swift
│   └── Concert.swift
├── Services/
│   ├── MusicBrainzClient.swift (actor)
│   ├── SetlistFMClient.swift
│   └── KeychainManager.swift
├── ViewModels/
│   ├── SearchViewModel.swift
│   ├── ArtistDetailViewModel.swift
│   └── GraphViewModel.swift
├── Views/
│   ├── SearchView.swift
│   ├── ArtistDetailView.swift
│   └── GraphView.swift (iPad/Mac only)
├── Graph/
│   ├── GraphScene.swift (SKScene)
│   └── ArtistNode.swift (SKSpriteNode)
└── App/
    └── InterChordApp.swift
```

---

## Platform-Specific UI

### macOS
- `NavigationSplitView` three-column layout
- Sidebar: Search + Favorites
- Content: Results list
- Detail: Graph view
- Native menu bar and keyboard shortcuts

### iPadOS
- `NavigationSplitView` adaptive layout
- Touch gestures for graph (pinch, drag)
- Apple Pencil support (future)

### iOS (iPhone)
- `TabView` with tabs: Search, Favorites, Settings
- **No graph** – list-based companion experience
- Focus on quick lookups

---

## External API Integration

### MusicBrainz Client (Actor)

**API Notes (discovered during implementation):**
- Artist `type` field is optional in search results (some artists don't have it)
- Use `ArtistType?` not `ArtistType` in the model
- Default to `.other` when displaying if type is nil

```swift
actor MusicBrainzClient {
    private let privateServerURL = URL(string: "https://interchord.stonefrog.com/api/musicbrainz")!
    private let publicAPIURL = URL(string: "https://musicbrainz.org/ws/2")!
    private var lastPublicRequest: Date = .distantPast
    private let publicRateLimit: TimeInterval = 1.1

    func fetchArtist(mbid: String) async throws -> Artist {
        // 1. Try private server (no rate limit)
        // 2. Check local cache
        // 3. Fall back to public API (rate limited)
    }
}
```

### Setlist.fm
- Direct API call with key in Keychain
- Fallback: proxy via stonefrog-db01

### Spotify OAuth
- `ASWebAuthenticationSession`
- Token stored in Keychain
- Scopes: `user-top-read`, `user-follow-read`

---

## Security

| Asset | Protection |
|-------|------------|
| Spotify tokens | Keychain (`kSecAttrAccessibleWhenUnlockedThisDeviceOnly`) |
| Setlist.fm key | Keychain, fetched on first launch |
| User data | SwiftData (on-device) |
| Cached data | Standard file protection |

**No hardcoded secrets.**

---

## Testing Strategy

| Type | Framework | Coverage |
|------|-----------|----------|
| Unit | XCTest | ViewModels, API clients, data parsing |
| UI | XCUITest | Search, favorites, OAuth flows |
| Snapshot | swift-snapshot-testing | Key SwiftUI views |

---

## Accessibility

| Requirement | Implementation |
|-------------|----------------|
| VoiceOver | All elements labeled |
| Dynamic Type | System fonts only |
| Color Contrast | WCAG AA (4.5:1) |
| Reduce Motion | Respect `accessibilityReduceMotion` |
| Voice Control | All buttons tappable |

---

## Future: Apple Music / MusicKit

Not in initial scope. Future milestone:

- MusicKit framework for library access
- `MusicAuthorization.request()` for permission
- Import user's library to favorites

---

## Related Documents

- `APPLE_DEV_PERSONA.md` – Coding standards and priorities
- `GRAPH_REFACTOR_PLAN.md` – Web app graph improvements (separate track)
- `Advanced_Apple_Developer_Resources.md` – Learning resources
