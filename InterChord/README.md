# InterChord Native App

Native macOS, iPadOS, and iOS app for music artist relationship discovery.

## Setup

### Option 1: Create Xcode Project (Recommended)

1. Open Xcode
2. File → New → Project
3. Choose "Multiplatform → App"
4. Product Name: `InterChord`
5. Organization Identifier: `com.stonefrog`
6. Interface: SwiftUI
7. Language: Swift
8. Storage: None (we'll add SwiftData in Phase 2)
9. **IMPORTANT:** Uncheck "Include Tests" (we'll add manually)

After creating, drag these folders into the project:
- `InterChord/App/`
- `InterChord/Models/`
- `InterChord/Services/`
- `InterChord/ViewModels/`
- `InterChord/Views/`
- `InterChordTests/` (add as test target)

### Option 2: Use Swift Package Manager

```bash
cd InterChord
swift build
swift test
```

Note: SPM doesn't support full iOS/macOS app bundles, but works for development.

## Project Structure

```
InterChord/
├── InterChord/
│   ├── App/
│   │   └── InterChordApp.swift       # Main entry point
│   ├── Models/
│   │   ├── Artist.swift              # Artist model + Codable
│   │   ├── Relationship.swift        # Relationship model
│   │   └── Concert.swift             # Concert/Setlist model
│   ├── Services/
│   │   └── MusicBrainzClient.swift   # API client (actor)
│   ├── ViewModels/
│   │   └── SearchViewModel.swift     # Search state management
│   └── Views/
│       └── SearchView.swift          # Search UI
├── InterChordTests/
│   └── MusicBrainzClientTests.swift  # Unit tests
├── Package.swift                     # SPM manifest (dev only)
└── README.md
```

## Data Source Priority

1. **stonefrog-db01** (private MusicBrainz mirror) - No rate limit
2. **Local Cache** (SwiftData) - Coming in Phase 2
3. **Public MusicBrainz API** - 1 req/sec rate limit

## Phase 1 Checklist

- [x] Create project structure
- [x] Define Swift models (Artist, Relationship, Concert)
- [x] Implement MusicBrainzClient actor
- [x] Implement SearchView with TextField
- [x] Display search results in List
- [x] Write unit tests (11 tests, all passing)
- [x] Build succeeds (`swift build`)
- [x] Tests pass (`swift test`)
- [x] Integration test: Search "Beatles" returns results
- [x] Verified: Falls back to public API when stonefrog-db01 unreachable

**Next Steps:**
1. Create Xcode project for full app bundle
2. Test on macOS and iOS Simulator
3. Proceed to Phase 2 (Core UI)

## Requirements

- Xcode 15.0+
- macOS 14.0+ (Sonoma)
- iOS 17.0+
- Swift 5.9+

## Related Documentation

- `doc/NATIVE_APP_CONVERSION_PLAN.md` - Full migration plan
- `doc/APPLE_DEV_PERSONA.md` - Coding standards
- `doc/Advanced_Apple_Developer_Resources.md` - Learning resources
