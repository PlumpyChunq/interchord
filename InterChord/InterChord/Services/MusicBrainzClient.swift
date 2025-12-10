import Foundation

/// Thread-safe MusicBrainz API client using Swift actor.
///
/// Data source priority (per NATIVE_APP_CONVERSION_PLAN.md):
/// 1. stonefrog-db01 (private server) - No rate limit
/// 2. Local cache - Offline support (Phase 2)
/// 3. Public MusicBrainz API - 1 req/sec rate limit
actor MusicBrainzClient {
    // MARK: - Types

    enum DataSource: String, Sendable {
        case privateServer = "stonefrog-db01"
        case localCache = "cache"
        case publicAPI = "musicbrainz.org"
    }

    enum ClientError: Error, LocalizedError {
        case invalidURL
        case networkError(Error)
        case decodingError(Error)
        case rateLimitExceeded
        case serverUnreachable
        case noResults

        var errorDescription: String? {
            switch self {
            case .invalidURL:
                return "Invalid URL"
            case .networkError(let error):
                return "Network error: \(error.localizedDescription)"
            case .decodingError(let error):
                return "Failed to parse response: \(error.localizedDescription)"
            case .rateLimitExceeded:
                return "Rate limit exceeded. Please wait."
            case .serverUnreachable:
                return "Server is unreachable"
            case .noResults:
                return "No results found"
            }
        }
    }

    // MARK: - Configuration

    /// Private server URL (stonefrog-db01 via Cloudflare tunnel)
    private let privateServerURL = URL(string: "https://interchord.stonefrog.com/api/musicbrainz")!

    /// Public MusicBrainz API URL
    private let publicAPIURL = URL(string: "https://musicbrainz.org/ws/2")!

    /// User agent required by MusicBrainz
    private let userAgent = "InterChord/1.0 (https://github.com/jstone/interchord)"

    /// Rate limit for public API (1 request per second + buffer)
    private let publicRateLimit: TimeInterval = 1.1

    // MARK: - State

    /// Last request time for rate limiting public API
    private var lastPublicRequest: Date = .distantPast

    /// Track which data source was last used (for debugging/UI)
    private(set) var lastDataSource: DataSource?

    /// Whether private server is reachable (cached check)
    private var isPrivateServerReachable: Bool?
    private var lastReachabilityCheck: Date = .distantPast
    private let reachabilityCheckInterval: TimeInterval = 60 // Re-check every minute

    // MARK: - URLSession

    private let session: URLSession

    init(session: URLSession = .shared) {
        self.session = session
    }

    // MARK: - Public API

    /// Search for artists by name.
    /// - Parameter query: Search query string
    /// - Returns: Array of matching artists
    func searchArtists(query: String) async throws -> [Artist] {
        guard !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return []
        }

        let encodedQuery = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query

        // Try private server first
        if await checkPrivateServerReachability() {
            do {
                let artists = try await searchFromPrivateServer(query: encodedQuery)
                lastDataSource = .privateServer
                return artists
            } catch {
                // Fall through to public API
            }
        }

        // Fall back to public API with rate limiting
        let artists = try await searchFromPublicAPI(query: encodedQuery)
        lastDataSource = .publicAPI
        return artists
    }

    /// Fetch artist details by MBID.
    /// - Parameter mbid: MusicBrainz ID
    /// - Returns: Artist with full details
    func fetchArtist(mbid: String) async throws -> Artist {
        // Try private server first
        if await checkPrivateServerReachability() {
            do {
                let artist = try await fetchArtistFromPrivateServer(mbid: mbid)
                lastDataSource = .privateServer
                return artist
            } catch {
                // Fall through to public API
            }
        }

        // Fall back to public API
        let artist = try await fetchArtistFromPublicAPI(mbid: mbid)
        lastDataSource = .publicAPI
        return artist
    }

    /// Fetch relationships for an artist.
    /// - Parameter mbid: MusicBrainz ID
    /// - Returns: Array of relationships
    func fetchRelationships(mbid: String) async throws -> [Relationship] {
        // Try private server first
        if await checkPrivateServerReachability() {
            do {
                let relationships = try await fetchRelationshipsFromPrivateServer(mbid: mbid)
                lastDataSource = .privateServer
                return relationships
            } catch {
                // Fall through to public API
            }
        }

        // Fall back to public API
        let relationships = try await fetchRelationshipsFromPublicAPI(mbid: mbid)
        lastDataSource = .publicAPI
        return relationships
    }

    // MARK: - Private Server Methods

    private func searchFromPrivateServer(query: String) async throws -> [Artist] {
        // The private server proxies to MusicBrainz API
        // Endpoint: /search?type=artist&query=...
        var urlComponents = URLComponents(url: privateServerURL, resolvingAgainstBaseURL: false)!
        urlComponents.path += "/search"
        urlComponents.queryItems = [
            URLQueryItem(name: "type", value: "artist"),
            URLQueryItem(name: "query", value: query),
            URLQueryItem(name: "fmt", value: "json"),
            URLQueryItem(name: "limit", value: "25")
        ]

        guard let url = urlComponents.url else {
            throw ClientError.invalidURL
        }

        let (data, _) = try await session.data(from: url)
        let response = try JSONDecoder().decode(ArtistSearchResponse.self, from: data)
        return response.artists
    }

    private func fetchArtistFromPrivateServer(mbid: String) async throws -> Artist {
        var urlComponents = URLComponents(url: privateServerURL, resolvingAgainstBaseURL: false)!
        urlComponents.path += "/artist/\(mbid)"
        urlComponents.queryItems = [
            URLQueryItem(name: "fmt", value: "json")
        ]

        guard let url = urlComponents.url else {
            throw ClientError.invalidURL
        }

        let (data, _) = try await session.data(from: url)
        return try JSONDecoder().decode(Artist.self, from: data)
    }

    private func fetchRelationshipsFromPrivateServer(mbid: String) async throws -> [Relationship] {
        var urlComponents = URLComponents(url: privateServerURL, resolvingAgainstBaseURL: false)!
        urlComponents.path += "/artist/\(mbid)"
        urlComponents.queryItems = [
            URLQueryItem(name: "inc", value: "artist-rels"),
            URLQueryItem(name: "fmt", value: "json")
        ]

        guard let url = urlComponents.url else {
            throw ClientError.invalidURL
        }

        let (data, _) = try await session.data(from: url)
        let response = try JSONDecoder().decode(ArtistRelationshipsResponse.self, from: data)
        return parseRelationships(from: response, sourceArtistId: mbid)
    }

    // MARK: - Public API Methods

    private func searchFromPublicAPI(query: String) async throws -> [Artist] {
        try await enforceRateLimit()

        var urlComponents = URLComponents(url: publicAPIURL, resolvingAgainstBaseURL: false)!
        urlComponents.path += "/artist"
        urlComponents.queryItems = [
            URLQueryItem(name: "query", value: query),
            URLQueryItem(name: "fmt", value: "json"),
            URLQueryItem(name: "limit", value: "25")
        ]

        guard let url = urlComponents.url else {
            throw ClientError.invalidURL
        }

        var request = URLRequest(url: url)
        request.setValue(userAgent, forHTTPHeaderField: "User-Agent")

        let (data, _) = try await session.data(for: request)
        let response = try JSONDecoder().decode(ArtistSearchResponse.self, from: data)
        return response.artists
    }

    private func fetchArtistFromPublicAPI(mbid: String) async throws -> Artist {
        try await enforceRateLimit()

        var urlComponents = URLComponents(url: publicAPIURL, resolvingAgainstBaseURL: false)!
        urlComponents.path += "/artist/\(mbid)"
        urlComponents.queryItems = [
            URLQueryItem(name: "fmt", value: "json")
        ]

        guard let url = urlComponents.url else {
            throw ClientError.invalidURL
        }

        var request = URLRequest(url: url)
        request.setValue(userAgent, forHTTPHeaderField: "User-Agent")

        let (data, _) = try await session.data(for: request)
        return try JSONDecoder().decode(Artist.self, from: data)
    }

    private func fetchRelationshipsFromPublicAPI(mbid: String) async throws -> [Relationship] {
        try await enforceRateLimit()

        var urlComponents = URLComponents(url: publicAPIURL, resolvingAgainstBaseURL: false)!
        urlComponents.path += "/artist/\(mbid)"
        urlComponents.queryItems = [
            URLQueryItem(name: "inc", value: "artist-rels"),
            URLQueryItem(name: "fmt", value: "json")
        ]

        guard let url = urlComponents.url else {
            throw ClientError.invalidURL
        }

        var request = URLRequest(url: url)
        request.setValue(userAgent, forHTTPHeaderField: "User-Agent")

        let (data, _) = try await session.data(for: request)
        let response = try JSONDecoder().decode(ArtistRelationshipsResponse.self, from: data)
        return parseRelationships(from: response, sourceArtistId: mbid)
    }

    // MARK: - Rate Limiting

    private func enforceRateLimit() async throws {
        let elapsed = Date().timeIntervalSince(lastPublicRequest)
        if elapsed < publicRateLimit {
            let delay = publicRateLimit - elapsed
            try await Task.sleep(for: .seconds(delay))
        }
        lastPublicRequest = Date()
    }

    // MARK: - Reachability

    private func checkPrivateServerReachability() async -> Bool {
        // Use cached result if recent
        let elapsed = Date().timeIntervalSince(lastReachabilityCheck)
        if elapsed < reachabilityCheckInterval, let cached = isPrivateServerReachable {
            return cached
        }

        // Ping health endpoint
        let healthURL = privateServerURL.appendingPathComponent("health")
        do {
            let (_, response) = try await session.data(from: healthURL)
            let isReachable = (response as? HTTPURLResponse)?.statusCode == 200
            isPrivateServerReachable = isReachable
            lastReachabilityCheck = Date()
            return isReachable
        } catch {
            isPrivateServerReachable = false
            lastReachabilityCheck = Date()
            return false
        }
    }

    // MARK: - Parsing Helpers

    private func parseRelationships(from response: ArtistRelationshipsResponse, sourceArtistId: String) -> [Relationship] {
        guard let relations = response.relations else { return [] }

        return relations.compactMap { relation -> Relationship? in
            guard let targetArtist = relation.artist else { return nil }

            let type = RelationshipType(rawValue: relation.type) ?? .other
            let direction = RelationshipDirection(rawValue: relation.direction ?? "forward") ?? .forward

            return Relationship(
                type: type,
                sourceArtistId: sourceArtistId,
                targetArtistId: targetArtist.id,
                targetArtist: targetArtist,
                direction: direction,
                attributes: relation.attributes,
                begin: relation.begin,
                end: relation.end,
                ended: relation.ended
            )
        }
    }
}
