import SwiftUI

/// Main entry point for the InterChord app.
/// Targets: macOS 14+, iOS 17+, iPadOS 17+
///
/// Note: The @main attribute is commented out for SPM builds.
/// When creating an Xcode project, uncomment @main.
// @main
struct InterChordApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        #if os(macOS)
        .windowStyle(.automatic)
        .defaultSize(width: 1200, height: 800)
        #endif
    }
}

/// Root content view that adapts to platform
struct ContentView: View {
    @State private var searchViewModel = SearchViewModel()

    var body: some View {
        #if os(macOS) || os(iOS)
        NavigationSplitView {
            SearchView(viewModel: searchViewModel)
        } detail: {
            if let selectedArtist = searchViewModel.selectedArtist {
                ArtistDetailPlaceholder(artist: selectedArtist)
            } else {
                ContentUnavailableView(
                    "Select an Artist",
                    systemImage: "music.note",
                    description: Text("Search for an artist to view their details")
                )
            }
        }
        #endif
    }
}

/// Placeholder for artist detail view (Phase 2)
struct ArtistDetailPlaceholder: View {
    let artist: Artist

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: (artist.type ?? .other) == .group ? "person.3.fill" : "person.fill")
                .font(.system(size: 64))
                .foregroundStyle(.secondary)

            Text(artist.name)
                .font(.largeTitle)

            if let disambiguation = artist.disambiguation {
                Text(disambiguation)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Text("Detail view coming in Phase 2")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

#Preview {
    ContentView()
}
