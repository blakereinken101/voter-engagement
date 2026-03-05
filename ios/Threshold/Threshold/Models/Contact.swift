import Foundation

// MARK: - Relationship Category

enum RelationshipCategory: String, Codable, CaseIterable, Identifiable {
    case household
    case closeFamily = "close-family"
    case extendedFamily = "extended-family"
    case bestFriends = "best-friends"
    case closeFriends = "close-friends"
    case neighbors
    case coworkers
    case faithCommunity = "faith-community"
    case schoolPta = "school-pta"
    case sportsRecreation = "sports-recreation"
    case hobbyGroups = "hobby-groups"
    case communityRegulars = "community-regulars"
    case recentMeals = "recent-meals"
    case whoDidWeMiss = "who-did-we-miss"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .household: return "Household"
        case .closeFamily: return "Close Family"
        case .extendedFamily: return "Extended Family"
        case .bestFriends: return "Best Friends"
        case .closeFriends: return "Close Friends"
        case .neighbors: return "Neighbors"
        case .coworkers: return "Coworkers"
        case .faithCommunity: return "Faith Community"
        case .schoolPta: return "School / PTA"
        case .sportsRecreation: return "Sports & Recreation"
        case .hobbyGroups: return "Hobby Groups"
        case .communityRegulars: return "Community Regulars"
        case .recentMeals: return "Recent Meals"
        case .whoDidWeMiss: return "Who Did We Miss?"
        }
    }

    var icon: String {
        switch self {
        case .household: return "house.fill"
        case .closeFamily: return "heart.fill"
        case .extendedFamily: return "person.3.fill"
        case .bestFriends: return "star.fill"
        case .closeFriends: return "person.2.fill"
        case .neighbors: return "building.2.fill"
        case .coworkers: return "briefcase.fill"
        case .faithCommunity: return "hands.sparkles.fill"
        case .schoolPta: return "graduationcap.fill"
        case .sportsRecreation: return "sportscourt.fill"
        case .hobbyGroups: return "paintpalette.fill"
        case .communityRegulars: return "storefront.fill"
        case .recentMeals: return "fork.knife"
        case .whoDidWeMiss: return "questionmark.circle.fill"
        }
    }

    var question: String {
        switch self {
        case .household: return "Who lives in your household?"
        case .closeFamily: return "Who are your closest family members?"
        case .extendedFamily: return "What about extended family?"
        case .bestFriends: return "Who are your best friends?"
        case .closeFriends: return "Who else are you close friends with?"
        case .neighbors: return "Who are your neighbors?"
        case .coworkers: return "Who do you work with?"
        case .faithCommunity: return "Who do you know from your faith community?"
        case .schoolPta: return "Who do you know from school or PTA?"
        case .sportsRecreation: return "Who do you know from sports or recreation?"
        case .hobbyGroups: return "Who do you know from hobby groups?"
        case .communityRegulars: return "Who do you see regularly in your community?"
        case .recentMeals: return "Who have you shared a meal with recently?"
        case .whoDidWeMiss: return "Anyone else we may have missed?"
        }
    }

    var examples: [String] {
        switch self {
        case .household: return ["Spouse / partner", "Kids (18+)", "Roommates"]
        case .closeFamily: return ["Parents", "Siblings", "In-laws"]
        case .extendedFamily: return ["Aunts, uncles", "Cousins", "Grandparents"]
        case .bestFriends: return ["Childhood friends", "College friends", "Your inner circle"]
        case .closeFriends: return ["Friend groups", "Couples you hang out with"]
        case .neighbors: return ["Next door", "Down the street", "Apartment building"]
        case .coworkers: return ["Desk neighbors", "Lunch crew", "Work friends"]
        case .faithCommunity: return ["Church, mosque, temple", "Bible study", "Volunteer groups"]
        case .schoolPta: return ["Other parents", "Teachers", "Coaches"]
        case .sportsRecreation: return ["Teammates", "Gym buddies", "Running club"]
        case .hobbyGroups: return ["Book club", "Gaming group", "Craft circle"]
        case .communityRegulars: return ["Coffee shop", "Dog park", "Local bar"]
        case .recentMeals: return ["Dinner party guests", "Brunch crew"]
        case .whoDidWeMiss: return ["Anyone else!", "People from other circles"]
        }
    }

    var minSuggested: Int {
        switch self {
        case .household: return 1
        case .closeFamily, .extendedFamily: return 2
        case .bestFriends, .closeFriends: return 3
        case .neighbors, .coworkers: return 2
        case .faithCommunity, .schoolPta: return 2
        case .sportsRecreation, .hobbyGroups: return 1
        case .communityRegulars, .recentMeals: return 1
        case .whoDidWeMiss: return 0
        }
    }
}

// MARK: - Person Entry

struct PersonEntry: Codable, Identifiable {
    let id: String
    var firstName: String
    var lastName: String
    var phone: String?
    var address: String?
    var city: String?
    var zip: String?
    var age: Int?
    var ageRange: String?
    var gender: String?
    var category: RelationshipCategory
    var createdAt: Int?

    var fullName: String {
        "\(firstName) \(lastName)".trimmingCharacters(in: .whitespaces)
    }

    var initials: String {
        let first = firstName.prefix(1).uppercased()
        let last = lastName.prefix(1).uppercased()
        return "\(first)\(last)"
    }
}

// MARK: - Contacts API Response

struct ContactsResponse: Codable {
    let personEntries: [PersonEntry]
    let matchResults: [MatchResult]
    let actionPlanState: [ActionPlanItem]
}
