import Foundation

// MARK: - Outreach Method

enum OutreachMethod: String, Codable, CaseIterable {
    case text
    case call
    case oneOnOne = "one-on-one"

    var displayName: String {
        switch self {
        case .text: return "Text"
        case .call: return "Call"
        case .oneOnOne: return "1-on-1"
        }
    }

    var icon: String {
        switch self {
        case .text: return "message.fill"
        case .call: return "phone.fill"
        case .oneOnOne: return "person.2.fill"
        }
    }
}

// MARK: - Contact Outcome

enum ContactOutcome: String, Codable, CaseIterable {
    case supporter
    case undecided
    case opposed
    case leftMessage = "left-message"
    case noAnswer = "no-answer"

    var displayName: String {
        switch self {
        case .supporter: return "Supporter"
        case .undecided: return "Undecided"
        case .opposed: return "Opposed"
        case .leftMessage: return "Left Message"
        case .noAnswer: return "No Answer"
        }
    }

    var icon: String {
        switch self {
        case .supporter: return "hand.thumbsup.fill"
        case .undecided: return "questionmark.circle.fill"
        case .opposed: return "hand.thumbsdown.fill"
        case .leftMessage: return "envelope.fill"
        case .noAnswer: return "phone.down.fill"
        }
    }

    var color: String {
        switch self {
        case .supporter: return "vcTeal"
        case .undecided: return "vcGold"
        case .opposed: return "vcCoral"
        case .leftMessage: return "vcSlate"
        case .noAnswer: return "vcSlate"
        }
    }
}

// MARK: - Volunteer Interest

enum VolunteerInterest: String, Codable, CaseIterable {
    case yes, no, maybe

    var displayName: String {
        switch self {
        case .yes: return "Yes"
        case .no: return "No"
        case .maybe: return "Maybe"
        }
    }
}

// MARK: - Action Plan Item

struct ActionPlanItem: Codable, Identifiable {
    var id: String { matchResult.id }
    let matchResult: MatchResult
    var contacted: Bool
    var contactedDate: String?
    var outreachMethod: OutreachMethod?
    var contactOutcome: ContactOutcome?
    var followUpDate: String?
    var notes: String?
    var volunteerInterest: VolunteerInterest?
    var recruitedDate: String?
    var surveyResponses: [String: String]?
}
