import Foundation

// MARK: - User

struct User: Codable, Identifiable {
    let id: String
    let email: String
    let name: String
    let isPlatformAdmin: Bool
    let createdAt: String?
}

// MARK: - Membership

struct Membership: Codable, Identifiable {
    let id: String
    let userId: String
    let campaignId: String
    let role: String
    let campaignName: String?
    let campaignSlug: String?
    let orgName: String?
    let joinedAt: String
    let isActive: Bool
}

// MARK: - Auth API Responses

struct SignInResponse: Codable {
    let requiresVerification: Bool?
    let email: String?
    let pendingToken: String?  // mobile only
}

struct VerifyCodeResponse: Codable {
    let user: User?
    let memberships: [Membership]?
    let activeMembership: Membership?
    let redirect: String?
    let sessionToken: String?  // mobile only
    let campaignId: String?    // mobile only
}

struct MeResponse: Codable {
    let user: User
    let memberships: [Membership]
    let activeMembership: Membership?
    let userProducts: [String]?
    let sessionToken: String?  // mobile only: refreshed JWT from server
}

// MARK: - Membership Roles

enum MembershipRole: String, Codable {
    case platformAdmin = "platform_admin"
    case orgOwner = "org_owner"
    case campaignAdmin = "campaign_admin"
    case organizer
    case volunteer
}
