import Foundation
import SwiftUI

/// ViewModel for artist search functionality.
/// Uses @Observable macro per APPLE_DEV_PERSONA.md.
@Observable
final class SearchViewModel: @unchecked Sendable {
    // MARK: - Published State

    /// Current search query text
    var searchQuery: String = ""

    /// Search results
    var searchResults: [Artist] = []

    /// Currently selected artist
    var selectedArtist: Artist?

    /// Loading state
    var isLoading: Bool = false

    /// Error message to display
    var errorMessage: String?

    /// Data source used for last request (for debugging)
    var lastDataSource: String?

    // MARK: - Dependencies

    private let client: MusicBrainzClient

    // MARK: - Private State

    /// Debounce task for search-as-you-type
    private var searchTask: Task<Void, Never>?

    // MARK: - Initialization

    init(client: MusicBrainzClient = MusicBrainzClient()) {
        self.client = client
    }

    // MARK: - Actions

    /// Perform search with debouncing.
    /// Called when searchQuery changes.
    func search() {
        // Cancel any pending search
        searchTask?.cancel()

        let query = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)

        // Clear results if query is empty
        guard !query.isEmpty else {
            searchResults = []
            errorMessage = nil
            return
        }

        // Debounce: wait 300ms before searching
        searchTask = Task { [weak self] in
            do {
                try await Task.sleep(for: .milliseconds(300))
            } catch {
                return // Cancelled
            }

            guard let self = self, !Task.isCancelled else { return }

            await self.performSearch(query: query)
        }
    }

    /// Perform the actual search.
    @MainActor
    private func performSearch(query: String) async {
        isLoading = true
        errorMessage = nil

        do {
            let results = try await client.searchArtists(query: query)
            lastDataSource = await client.lastDataSource?.rawValue

            // Only update if this is still the current query
            if searchQuery.trimmingCharacters(in: .whitespacesAndNewlines) == query {
                searchResults = results
                if results.isEmpty {
                    errorMessage = "No artists found for \"\(query)\""
                }
            }
        } catch {
            if searchQuery.trimmingCharacters(in: .whitespacesAndNewlines) == query {
                errorMessage = error.localizedDescription
                searchResults = []
            }
        }

        isLoading = false
    }

    /// Select an artist from search results.
    func selectArtist(_ artist: Artist) {
        selectedArtist = artist
    }

    /// Clear search and selection.
    func clearSearch() {
        searchQuery = ""
        searchResults = []
        selectedArtist = nil
        errorMessage = nil
    }
}
