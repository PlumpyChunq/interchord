import Foundation

/// Represents a concert/setlist from the Setlist.fm API.
struct Concert: Identifiable, Codable, Hashable, Sendable {
    /// Setlist.fm ID
    let id: String

    /// Event date
    let eventDate: Date?

    /// Raw event date string from API (format: dd-MM-yyyy)
    let eventDateString: String

    /// Venue information
    let venue: Venue

    /// Tour name (if part of a tour)
    let tour: Tour?

    /// URL to the setlist on Setlist.fm
    let url: String?

    enum CodingKeys: String, CodingKey {
        case id
        case eventDateString = "eventDate"
        case venue
        case tour
        case url
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try container.decode(String.self, forKey: .id)
        self.eventDateString = try container.decode(String.self, forKey: .eventDateString)
        self.venue = try container.decode(Venue.self, forKey: .venue)
        self.tour = try container.decodeIfPresent(Tour.self, forKey: .tour)
        self.url = try container.decodeIfPresent(String.self, forKey: .url)

        // Parse date from dd-MM-yyyy format
        let formatter = DateFormatter()
        formatter.dateFormat = "dd-MM-yyyy"
        self.eventDate = formatter.date(from: eventDateString)
    }

    init(
        id: String,
        eventDateString: String,
        venue: Venue,
        tour: Tour? = nil,
        url: String? = nil
    ) {
        self.id = id
        self.eventDateString = eventDateString
        self.venue = venue
        self.tour = tour
        self.url = url

        let formatter = DateFormatter()
        formatter.dateFormat = "dd-MM-yyyy"
        self.eventDate = formatter.date(from: eventDateString)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(eventDateString, forKey: .eventDateString)
        try container.encode(venue, forKey: .venue)
        try container.encodeIfPresent(tour, forKey: .tour)
        try container.encodeIfPresent(url, forKey: .url)
    }
}

/// Venue information
struct Venue: Codable, Hashable, Sendable {
    let id: String?
    let name: String
    let city: City

    /// Formatted location string
    var formattedLocation: String {
        var parts = [city.name]
        if let state = city.state, !state.isEmpty {
            parts.append(state)
        }
        if let country = city.country?.name {
            parts.append(country)
        }
        return parts.joined(separator: ", ")
    }
}

/// City information
struct City: Codable, Hashable, Sendable {
    let id: String?
    let name: String
    let state: String?
    let country: Country?
}

/// Country information
struct Country: Codable, Hashable, Sendable {
    let code: String
    let name: String
}

/// Tour information
struct Tour: Codable, Hashable, Sendable {
    let name: String
}

/// Setlist.fm API response wrapper
struct SetlistSearchResponse: Codable, Sendable {
    let type: String?
    let itemsPerPage: Int
    let page: Int
    let total: Int
    let setlist: [Concert]
}
