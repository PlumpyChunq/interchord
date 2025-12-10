import Foundation

/// Represents a relationship between two artists from MusicBrainz.
struct Relationship: Identifiable, Codable, Hashable, Sendable {
    /// Unique identifier (constructed from source + target + type)
    var id: String {
        "\(sourceArtistId)-\(targetArtistId)-\(type.rawValue)"
    }

    /// The type of relationship
    let type: RelationshipType

    /// Source artist MBID
    let sourceArtistId: String

    /// Target artist MBID
    let targetArtistId: String

    /// Target artist details (when included in response)
    let targetArtist: Artist?

    /// Direction of the relationship
    let direction: RelationshipDirection

    /// Attributes providing additional context
    let attributes: [String]?

    /// Date range when the relationship was active
    let begin: String?
    let end: String?
    let ended: Bool?

    init(
        type: RelationshipType,
        sourceArtistId: String,
        targetArtistId: String,
        targetArtist: Artist? = nil,
        direction: RelationshipDirection = .forward,
        attributes: [String]? = nil,
        begin: String? = nil,
        end: String? = nil,
        ended: Bool? = nil
    ) {
        self.type = type
        self.sourceArtistId = sourceArtistId
        self.targetArtistId = targetArtistId
        self.targetArtist = targetArtist
        self.direction = direction
        self.attributes = attributes
        self.begin = begin
        self.end = end
        self.ended = ended
    }
}

/// Types of artist-to-artist relationships
enum RelationshipType: String, Codable, Hashable, Sendable, CaseIterable {
    case memberOf = "member of band"
    case founderOf = "founder"
    case collaboration = "collaboration"
    case subgroup = "subgroup"
    case artistRename = "artist rename"
    case supportingMusician = "support"
    case vocalSupport = "vocal"
    case instrumental = "instrumental"
    case conductor = "conductor position"
    case musicalDirector = "musical director"
    case tribute = "tribute"
    case other

    /// Human-readable display name
    var displayName: String {
        switch self {
        case .memberOf: return "Member of"
        case .founderOf: return "Founder of"
        case .collaboration: return "Collaboration"
        case .subgroup: return "Subgroup"
        case .artistRename: return "Also known as"
        case .supportingMusician: return "Supporting musician"
        case .vocalSupport: return "Vocals"
        case .instrumental: return "Instrumental"
        case .conductor: return "Conductor"
        case .musicalDirector: return "Musical Director"
        case .tribute: return "Tribute to"
        case .other: return "Related"
        }
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = try? container.decode(String.self)
        self = RelationshipType(rawValue: rawValue ?? "") ?? .other
    }
}

/// Direction of the relationship relative to the queried artist
enum RelationshipDirection: String, Codable, Hashable, Sendable {
    case forward
    case backward
}

/// MusicBrainz relationship response for artist lookup
struct ArtistRelationshipsResponse: Codable, Sendable {
    let id: String
    let name: String
    let relations: [MBRelation]?
}

/// Raw MusicBrainz relation structure
struct MBRelation: Codable, Sendable {
    let type: String
    let direction: String?
    let artist: Artist?
    let attributes: [String]?
    let begin: String?
    let end: String?
    let ended: Bool?
}
