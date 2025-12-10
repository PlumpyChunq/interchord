import SwiftUI

/// Artist search view with TextField and results List.
/// Per NATIVE_APP_CONVERSION_PLAN.md Phase 1 requirements.
struct SearchView: View {
    @Bindable var viewModel: SearchViewModel

    var body: some View {
        List(selection: Binding(
            get: { viewModel.selectedArtist },
            set: { viewModel.selectedArtist = $0 }
        )) {
            // Search results section
            if !viewModel.searchResults.isEmpty {
                Section("Results") {
                    ForEach(viewModel.searchResults) { artist in
                        ArtistRow(artist: artist)
                            .tag(artist)
                    }
                }
            }

            // Error or empty state
            if let errorMessage = viewModel.errorMessage {
                Section {
                    ContentUnavailableView(
                        "No Results",
                        systemImage: "magnifyingglass",
                        description: Text(errorMessage)
                    )
                }
            }

            // Data source indicator (debug info)
            if let dataSource = viewModel.lastDataSource, !viewModel.searchResults.isEmpty {
                Section {
                    Label("Data from: \(dataSource)", systemImage: "server.rack")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .listStyle(.sidebar)
        .searchable(
            text: $viewModel.searchQuery,
            placement: .sidebar,
            prompt: "Search artists..."
        )
        .onChange(of: viewModel.searchQuery) { _, _ in
            viewModel.search()
        }
        .overlay {
            if viewModel.isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(.ultraThinMaterial)
            }
        }
        .navigationTitle("Search")
        #if os(macOS)
        .navigationSubtitle(viewModel.searchResults.isEmpty ? "" : "\(viewModel.searchResults.count) results")
        #endif
    }
}

/// Row view for a single artist in the search results.
struct ArtistRow: View {
    let artist: Artist

    var body: some View {
        HStack(spacing: 12) {
            // Artist type icon
            Image(systemName: (artist.type ?? .other) == .group ? "person.3.fill" : "person.fill")
                .font(.title2)
                .foregroundStyle(.secondary)
                .frame(width: 32, height: 32)
                .background(.quaternary)
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 2) {
                Text(artist.name)
                    .font(.body)
                    .lineLimit(1)

                if let disambiguation = artist.disambiguation, !disambiguation.isEmpty {
                    Text(disambiguation)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }

            Spacer()

            // Country flag or code
            if let country = artist.country {
                Text(countryFlag(for: country))
                    .font(.caption)
            }
        }
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(artist.name), \((artist.type ?? .other) == .group ? "band" : "artist")")
        .accessibilityHint(artist.disambiguation ?? "")
    }

    /// Convert country code to flag emoji
    private func countryFlag(for code: String) -> String {
        let base: UInt32 = 127397
        var flag = ""
        for scalar in code.uppercased().unicodeScalars {
            if let unicode = UnicodeScalar(base + scalar.value) {
                flag.append(String(unicode))
            }
        }
        return flag.isEmpty ? code : flag
    }
}

#Preview {
    NavigationSplitView {
        SearchView(viewModel: SearchViewModel())
    } detail: {
        Text("Select an artist")
    }
}
