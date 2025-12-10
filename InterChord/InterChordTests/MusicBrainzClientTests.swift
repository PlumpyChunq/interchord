import XCTest
@testable import InterChord

/// Unit tests for MusicBrainzClient.
/// Per NATIVE_APP_CONVERSION_PLAN.md: "Write unit tests for MusicBrainzClient"
final class MusicBrainzClientTests: XCTestCase {

    // MARK: - Test Client

    var client: MusicBrainzClient!

    override func setUp() async throws {
        try await super.setUp()
        // Use a mock URLSession for deterministic tests in Phase 2
        // For now, use real client but with limited integration tests
        client = MusicBrainzClient()
    }

    override func tearDown() async throws {
        client = nil
        try await super.tearDown()
    }

    // MARK: - Model Decoding Tests

    func testArtistDecoding() throws {
        let json = """
        {
            "id": "b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d",
            "name": "The Beatles",
            "sort-name": "Beatles, The",
            "disambiguation": "legendary Liverpool band",
            "type": "Group",
            "country": "GB",
            "life-span": {
                "begin": "1960",
                "end": "1970",
                "ended": true
            }
        }
        """

        let data = json.data(using: .utf8)!
        let artist = try JSONDecoder().decode(Artist.self, from: data)

        XCTAssertEqual(artist.id, "b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d")
        XCTAssertEqual(artist.name, "The Beatles")
        XCTAssertEqual(artist.sortName, "Beatles, The")
        XCTAssertEqual(artist.disambiguation, "legendary Liverpool band")
        XCTAssertEqual(artist.type, .group)
        XCTAssertEqual(artist.country, "GB")
        XCTAssertEqual(artist.lifeSpan?.begin, "1960")
        XCTAssertEqual(artist.lifeSpan?.end, "1970")
        XCTAssertEqual(artist.lifeSpan?.ended, true)
    }

    func testArtistTypeDecoding() throws {
        let cases: [(String, ArtistType)] = [
            ("Person", .person),
            ("Group", .group),
            ("Orchestra", .orchestra),
            ("Choir", .choir),
            ("Character", .character),
            ("Unknown", .other),
            ("", .other)
        ]

        for (jsonValue, expectedType) in cases {
            let json = """
            {
                "id": "test-id",
                "name": "Test Artist",
                "type": "\(jsonValue)"
            }
            """
            let data = json.data(using: .utf8)!
            let artist = try JSONDecoder().decode(Artist.self, from: data)
            XCTAssertEqual(artist.type, expectedType, "Failed for type: \(jsonValue)")
        }
    }

    func testArtistWithoutType() throws {
        let json = """
        {
            "id": "test-id",
            "name": "Test Artist"
        }
        """
        let data = json.data(using: .utf8)!
        let artist = try JSONDecoder().decode(Artist.self, from: data)
        XCTAssertNil(artist.type, "Type should be nil when not present")
    }

    func testArtistSearchResponseDecoding() throws {
        let json = """
        {
            "created": "2025-12-10T12:00:00.000Z",
            "count": 100,
            "offset": 0,
            "artists": [
                {
                    "id": "b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d",
                    "name": "The Beatles",
                    "type": "Group"
                },
                {
                    "id": "3d2b98e5-556f-4451-a3ff-c50ea18d57cb",
                    "name": "Beatles",
                    "disambiguation": "Finnish band",
                    "type": "Group"
                }
            ]
        }
        """

        let data = json.data(using: .utf8)!
        let response = try JSONDecoder().decode(ArtistSearchResponse.self, from: data)

        XCTAssertEqual(response.count, 100)
        XCTAssertEqual(response.offset, 0)
        XCTAssertEqual(response.artists.count, 2)
        XCTAssertEqual(response.artists[0].name, "The Beatles")
        XCTAssertEqual(response.artists[1].disambiguation, "Finnish band")
    }

    func testRelationshipDecoding() throws {
        let json = """
        {
            "type": "member of band",
            "direction": "backward",
            "artist": {
                "id": "member-id",
                "name": "John Lennon",
                "type": "Person"
            },
            "attributes": ["lead vocals", "guitar"],
            "begin": "1960",
            "end": "1970",
            "ended": true
        }
        """

        let data = json.data(using: .utf8)!
        let relation = try JSONDecoder().decode(MBRelation.self, from: data)

        XCTAssertEqual(relation.type, "member of band")
        XCTAssertEqual(relation.direction, "backward")
        XCTAssertEqual(relation.artist?.name, "John Lennon")
        XCTAssertEqual(relation.attributes, ["lead vocals", "guitar"])
        XCTAssertEqual(relation.begin, "1960")
        XCTAssertEqual(relation.ended, true)
    }

    func testConcertDecoding() throws {
        let json = """
        {
            "id": "setlist-123",
            "eventDate": "01-07-1969",
            "venue": {
                "id": "venue-123",
                "name": "Madison Square Garden",
                "city": {
                    "id": "city-123",
                    "name": "New York",
                    "state": "NY",
                    "country": {
                        "code": "US",
                        "name": "United States"
                    }
                }
            },
            "tour": {
                "name": "Summer Tour 1969"
            },
            "url": "https://setlist.fm/setlist/123"
        }
        """

        let data = json.data(using: .utf8)!
        let concert = try JSONDecoder().decode(Concert.self, from: data)

        XCTAssertEqual(concert.id, "setlist-123")
        XCTAssertEqual(concert.eventDateString, "01-07-1969")
        XCTAssertEqual(concert.venue.name, "Madison Square Garden")
        XCTAssertEqual(concert.venue.city.name, "New York")
        XCTAssertEqual(concert.venue.city.state, "NY")
        XCTAssertEqual(concert.venue.city.country?.code, "US")
        XCTAssertEqual(concert.tour?.name, "Summer Tour 1969")
        XCTAssertNotNil(concert.eventDate)
    }

    func testVenueFormattedLocation() throws {
        let venue = Venue(
            id: "venue-123",
            name: "Test Venue",
            city: City(
                id: "city-123",
                name: "Los Angeles",
                state: "CA",
                country: Country(code: "US", name: "United States")
            )
        )

        XCTAssertEqual(venue.formattedLocation, "Los Angeles, CA, United States")
    }

    // MARK: - RelationshipType Tests

    func testRelationshipTypeDisplayName() {
        XCTAssertEqual(RelationshipType.memberOf.displayName, "Member of")
        XCTAssertEqual(RelationshipType.founderOf.displayName, "Founder of")
        XCTAssertEqual(RelationshipType.collaboration.displayName, "Collaboration")
        XCTAssertEqual(RelationshipType.other.displayName, "Related")
    }

    // MARK: - Integration Tests (Require Network)
    // These tests are disabled by default. Enable for manual testing.

    func testSearchArtistsIntegration() async throws {
        // Skip in CI - this requires network access
        try XCTSkipIf(ProcessInfo.processInfo.environment["CI"] != nil, "Skipping network test in CI")

        let results = try await client.searchArtists(query: "Beatles")

        XCTAssertFalse(results.isEmpty, "Expected results for 'Beatles' search")
        XCTAssertTrue(results.contains { $0.name.lowercased().contains("beatles") })
    }

    func testSearchEmptyQuery() async throws {
        let results = try await client.searchArtists(query: "")
        XCTAssertTrue(results.isEmpty, "Empty query should return empty results")
    }

    func testSearchWhitespaceQuery() async throws {
        let results = try await client.searchArtists(query: "   ")
        XCTAssertTrue(results.isEmpty, "Whitespace query should return empty results")
    }
}
