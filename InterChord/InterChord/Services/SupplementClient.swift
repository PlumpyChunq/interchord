import Foundation
import os.log

private let logger = Logger(subsystem: "com.stonefrog.InterChord", category: "SupplementClient")

/// Client for fetching Wikipedia-derived supplement data from the web API.
/// This enriches MusicBrainz data with founding member information.
actor SupplementClient {
    // MARK: - Types

    /// Response from the supplement API
    struct SupplementResponse: Codable, Sendable {
        let artist: ArtistSupplement?
        let foundingMembers: [FoundingMember]
        let foundingMemberMbids: [String]
    }

    struct ArtistSupplement: Codable, Sendable {
        let mbid: String
        let name: String
        let wikipediaTitle: String?
        let formationYear: Int?
        let formationCity: String?
        let formationState: String?
        let formationCountry: String?
        let wikipediaExtract: String?
    }

    struct FoundingMember: Codable, Sendable {
        let id: Int
        let bandMbid: String
        let memberName: String
        let memberMbid: String?
        let instruments: [String]?
        let confidence: Double
        let matchMethod: String
    }

    enum ClientError: Error, LocalizedError {
        case invalidURL
        case networkError(Error)
        case decodingError(Error)
        case notFound

        var errorDescription: String? {
            switch self {
            case .invalidURL:
                return "Invalid URL"
            case .networkError(let error):
                return "Network error: \(error.localizedDescription)"
            case .decodingError(let error):
                return "Failed to parse response: \(error.localizedDescription)"
            case .notFound:
                return "No supplement data found"
            }
        }
    }

    // MARK: - Configuration

    /// Web app API URL (local dev server or production)
    /// Using the Mac's local web app server
    private let baseURL: URL

    /// User agent for requests
    private let userAgent = "InterChord-Native/1.0"

    // MARK: - URLSession

    private let session: URLSession

    // MARK: - Cache

    /// In-memory cache for supplement data (keyed by MBID)
    private var cache: [String: Set<String>] = [:]

    // MARK: - Initialization

    init(
        baseURL: URL = URL(string: "http://127.0.0.1:3000/api")!,
        session: URLSession = .shared
    ) {
        self.baseURL = baseURL
        self.session = session
    }

    // MARK: - Public API

    /// Fetch founding member MBIDs for a band/group.
    /// - Parameters:
    ///   - mbid: MusicBrainz ID of the band
    ///   - name: Name of the band (used for Wikipedia lookup)
    /// - Returns: Set of MBIDs that are founding members (empty set if unavailable)
    func fetchFoundingMemberIds(mbid: String, name: String) async -> Set<String> {
        // Check cache first
        if let cached = cache[mbid] {
            return cached
        }

        // Build URL
        guard var components = URLComponents(url: baseURL.appendingPathComponent("supplement"), resolvingAgainstBaseURL: false) else {
            return []
        }
        components.queryItems = [
            URLQueryItem(name: "mbid", value: mbid),
            URLQueryItem(name: "name", value: name)
        ]

        guard let url = components.url else {
            return []
        }

        var request = URLRequest(url: url)
        request.setValue(userAgent, forHTTPHeaderField: "User-Agent")
        request.timeoutInterval = 10

        do {
            print("[SupplementClient] Fetching supplement for \(name) from \(url)")
            let (data, response) = try await session.data(for: request)

            // Check for 404 (no data found)
            if let httpResponse = response as? HTTPURLResponse {
                print("[SupplementClient] Response status: \(httpResponse.statusCode)")
                if httpResponse.statusCode == 404 {
                    print("[SupplementClient] No supplement data found (404)")
                    cache[mbid] = []
                    return []
                }
            }

            // Debug: print raw response
            if let jsonString = String(data: data, encoding: .utf8) {
                print("[SupplementClient] Raw response (first 300 chars): \(jsonString.prefix(300))")
            }

            let decoded = try JSONDecoder().decode(SupplementResponse.self, from: data)
            let founderIds = Set(decoded.foundingMemberMbids)

            print("[SupplementClient] ✅ Decoded \(founderIds.count) founding members: \(founderIds)")

            // Cache the result
            cache[mbid] = founderIds

            return founderIds
        } catch {
            // Don't throw on any errors - just return empty set
            // This allows the app to work offline or when web server is down
            print("[SupplementClient] ❌ Error: \(error)")
            return []
        }
    }

    /// Clear the cache
    func clearCache() {
        cache.removeAll()
    }
}
