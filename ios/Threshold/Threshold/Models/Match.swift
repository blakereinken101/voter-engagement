import Foundation

// MARK: - Vote Value

typealias VoteValue = String  // "Y", "N", "A", "E", ""

// MARK: - Match Status

enum MatchStatus: String, Codable {
    case confirmed
    case ambiguous
    case unmatched
    case pending
}

// MARK: - Voter Segment

enum VoterSegment: String, Codable {
    case superVoter = "super-voter"
    case sometimesVoter = "sometimes-voter"
    case rarelyVoter = "rarely-voter"

    var displayName: String {
        switch self {
        case .superVoter: return "Super Voter"
        case .sometimesVoter: return "Sometimes Voter"
        case .rarelyVoter: return "Rarely Voter"
        }
    }

    var priority: Int {
        switch self {
        case .superVoter: return 3
        case .sometimesVoter: return 1
        case .rarelyVoter: return 2
        }
    }
}

// MARK: - Confidence Level

enum ConfidenceLevel: String, Codable {
    case high
    case medium
    case low
    case veryLow = "very-low"
}

// MARK: - Safe Voter Record (sanitized, no voter_id)

struct SafeVoterRecord: Codable {
    let firstName: String
    let lastName: String
    let birthYear: String?
    let gender: String
    let residentialAddress: String
    let city: String
    let state: String
    let zip: String
    let partyAffiliation: String
    let registrationDate: String
    let voterStatus: String
    let vh2024G: VoteValue
    let vh2022G: VoteValue
    let vh2020G: VoteValue
    let vh2024P: VoteValue
    let vh2022P: VoteValue
    let vh2020P: VoteValue
    let lat: Double?
    let lng: Double?
    let phone: String?

    var fullName: String { "\(firstName) \(lastName)" }

    /// Vote codes that count as "voted" — In Person (Y), Absentee (A), Early (E)
    private static let votedCodes: Set<String> = ["Y", "A", "E"]

    /// Vote history entries as an array for display
    var voteHistory: [(election: String, voted: Bool)] {
        [
            ("2024 General", Self.votedCodes.contains(vh2024G)),
            ("2024 Primary", Self.votedCodes.contains(vh2024P)),
            ("2022 General", Self.votedCodes.contains(vh2022G)),
            ("2022 Primary", Self.votedCodes.contains(vh2022P)),
            ("2020 General", Self.votedCodes.contains(vh2020G)),
            ("2020 Primary", Self.votedCodes.contains(vh2020P)),
        ]
    }

    // Custom decoder: the voter record JSON from the DB uses snake_case for fields
    // (first_name, last_name, etc.) AND uppercase VH keys (VH2024G not vh2024G).
    // The global .convertFromSnakeCase strategy handles snake_case → camelCase,
    // but VH keys have no underscores so they stay uppercase. We need a custom
    // decoder to map uppercase VH keys to our lowercase Swift properties.

    private struct DynamicKey: CodingKey {
        var stringValue: String
        init?(stringValue: String) { self.stringValue = stringValue }
        var intValue: Int? { nil }
        init?(intValue: Int) { nil }
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: DynamicKey.self)

        // These keys are already converted by .convertFromSnakeCase
        firstName = try c.decode(String.self, forKey: DynamicKey(stringValue: "firstName")!)
        lastName = try c.decode(String.self, forKey: DynamicKey(stringValue: "lastName")!)
        birthYear = try c.decodeIfPresent(String.self, forKey: DynamicKey(stringValue: "birthYear")!)
        gender = try c.decodeIfPresent(String.self, forKey: DynamicKey(stringValue: "gender")!) ?? ""
        residentialAddress = try c.decodeIfPresent(String.self, forKey: DynamicKey(stringValue: "residentialAddress")!) ?? ""
        city = try c.decodeIfPresent(String.self, forKey: DynamicKey(stringValue: "city")!) ?? ""
        state = try c.decodeIfPresent(String.self, forKey: DynamicKey(stringValue: "state")!) ?? ""
        zip = try c.decodeIfPresent(String.self, forKey: DynamicKey(stringValue: "zip")!) ?? ""
        partyAffiliation = try c.decodeIfPresent(String.self, forKey: DynamicKey(stringValue: "partyAffiliation")!) ?? ""
        registrationDate = try c.decodeIfPresent(String.self, forKey: DynamicKey(stringValue: "registrationDate")!) ?? ""
        voterStatus = try c.decodeIfPresent(String.self, forKey: DynamicKey(stringValue: "voterStatus")!) ?? ""
        lat = try c.decodeIfPresent(Double.self, forKey: DynamicKey(stringValue: "lat")!)
        lng = try c.decodeIfPresent(Double.self, forKey: DynamicKey(stringValue: "lng")!)
        phone = try c.decodeIfPresent(String.self, forKey: DynamicKey(stringValue: "phone")!)

        // VH keys stay uppercase (no underscores to convert)
        vh2024G = (try? c.decode(String.self, forKey: DynamicKey(stringValue: "VH2024G")!)) ?? ""
        vh2022G = (try? c.decode(String.self, forKey: DynamicKey(stringValue: "VH2022G")!)) ?? ""
        vh2020G = (try? c.decode(String.self, forKey: DynamicKey(stringValue: "VH2020G")!)) ?? ""
        vh2024P = (try? c.decode(String.self, forKey: DynamicKey(stringValue: "VH2024P")!)) ?? ""
        vh2022P = (try? c.decode(String.self, forKey: DynamicKey(stringValue: "VH2022P")!)) ?? ""
        vh2020P = (try? c.decode(String.self, forKey: DynamicKey(stringValue: "VH2020P")!)) ?? ""
    }

    // Keep encoding for any future use
    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: DynamicKey.self)
        try c.encode(firstName, forKey: DynamicKey(stringValue: "firstName")!)
        try c.encode(lastName, forKey: DynamicKey(stringValue: "lastName")!)
        try c.encodeIfPresent(birthYear, forKey: DynamicKey(stringValue: "birthYear")!)
        try c.encode(gender, forKey: DynamicKey(stringValue: "gender")!)
        try c.encode(residentialAddress, forKey: DynamicKey(stringValue: "residentialAddress")!)
        try c.encode(city, forKey: DynamicKey(stringValue: "city")!)
        try c.encode(state, forKey: DynamicKey(stringValue: "state")!)
        try c.encode(zip, forKey: DynamicKey(stringValue: "zip")!)
        try c.encode(partyAffiliation, forKey: DynamicKey(stringValue: "partyAffiliation")!)
        try c.encode(registrationDate, forKey: DynamicKey(stringValue: "registrationDate")!)
        try c.encode(voterStatus, forKey: DynamicKey(stringValue: "voterStatus")!)
        try c.encodeIfPresent(lat, forKey: DynamicKey(stringValue: "lat")!)
        try c.encodeIfPresent(lng, forKey: DynamicKey(stringValue: "lng")!)
        try c.encodeIfPresent(phone, forKey: DynamicKey(stringValue: "phone")!)
        try c.encode(vh2024G, forKey: DynamicKey(stringValue: "VH2024G")!)
        try c.encode(vh2022G, forKey: DynamicKey(stringValue: "VH2022G")!)
        try c.encode(vh2020G, forKey: DynamicKey(stringValue: "VH2020G")!)
        try c.encode(vh2024P, forKey: DynamicKey(stringValue: "VH2024P")!)
        try c.encode(vh2022P, forKey: DynamicKey(stringValue: "VH2022P")!)
        try c.encode(vh2020P, forKey: DynamicKey(stringValue: "VH2020P")!)
    }
}

// MARK: - Match Candidate

struct MatchCandidate: Codable {
    let voterRecord: SafeVoterRecord
    let score: Double
    let confidenceLevel: ConfidenceLevel
    let matchedOn: [String]
    let aiConfidence: String?
    let aiReasoning: String?
}

// MARK: - Match Result

struct MatchResult: Codable, Identifiable {
    var id: String { personEntry.id }
    let personEntry: PersonEntry
    var status: MatchStatus
    var bestMatch: SafeVoterRecord?
    var candidates: [MatchCandidate]
    var voteScore: Double?
    var segment: VoterSegment?
    var userConfirmed: Bool?
}

// MARK: - Match API Response

struct MatchResponseBody: Codable {
    let results: [MatchResult]
    let processingTimeMs: Int?
}

// MARK: - Segmented Results

struct SegmentedResults {
    var superVoters: [MatchResult] = []
    var sometimesVoters: [MatchResult] = []
    var rarelyVoters: [MatchResult] = []
    var unmatched: [MatchResult] = []

    var totalEntered: Int {
        superVoters.count + sometimesVoters.count + rarelyVoters.count + unmatched.count
    }

    var totalMatched: Int {
        superVoters.count + sometimesVoters.count + rarelyVoters.count
    }

    init(from results: [MatchResult]) {
        for result in results {
            switch result.status {
            case .confirmed:
                switch result.segment {
                case .superVoter: superVoters.append(result)
                case .sometimesVoter: sometimesVoters.append(result)
                case .rarelyVoter: rarelyVoters.append(result)
                case nil: unmatched.append(result)
                }
            case .ambiguous, .unmatched, .pending:
                unmatched.append(result)
            }
        }
    }
}
