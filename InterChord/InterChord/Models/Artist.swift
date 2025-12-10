import Foundation

/// Represents an artist from the MusicBrainz API.
/// Conforms to Codable for JSON parsing and Identifiable for SwiftUI lists.
struct Artist: Identifiable, Codable, Hashable, Sendable {
    /// MusicBrainz ID (MBID) - a UUID string
    let id: String

    /// Artist's name
    let name: String

    /// Sort name (e.g., "Beatles, The")
    let sortName: String?

    /// Disambiguation text to distinguish artists with the same name
    let disambiguation: String?

    /// Artist type (optional - not always present in search results)
    let type: ArtistType?

    /// Country code (ISO 3166-1 alpha-2)
    let country: String?

    /// Life span information
    let lifeSpan: LifeSpan?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case sortName = "sort-name"
        case disambiguation
        case type
        case country
        case lifeSpan = "life-span"
    }

    init(
        id: String,
        name: String,
        sortName: String? = nil,
        disambiguation: String? = nil,
        type: ArtistType? = nil,
        country: String? = nil,
        lifeSpan: LifeSpan? = nil
    ) {
        self.id = id
        self.name = name
        self.sortName = sortName
        self.disambiguation = disambiguation
        self.type = type
        self.country = country
        self.lifeSpan = lifeSpan
    }
}

/// Artist type enumeration
enum ArtistType: String, Codable, Hashable, Sendable {
    case person = "Person"
    case group = "Group"
    case orchestra = "Orchestra"
    case choir = "Choir"
    case character = "Character"
    case other = "Other"

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = try? container.decode(String.self)
        self = ArtistType(rawValue: rawValue ?? "") ?? .other
    }
}

/// Life span information for an artist
struct LifeSpan: Codable, Hashable, Sendable {
    let begin: String?
    let end: String?
    let ended: Bool?
}

/// MusicBrainz search response wrapper
struct ArtistSearchResponse: Codable, Sendable {
    let created: String?
    let count: Int
    let offset: Int
    let artists: [Artist]
}
