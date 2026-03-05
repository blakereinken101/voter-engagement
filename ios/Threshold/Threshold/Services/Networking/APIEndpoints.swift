import Foundation

// MARK: - Auth Endpoints

enum AuthEndpoints {
    static func signIn(email: String, password: String, product: String? = nil) -> APIEndpoint {
        struct Body: Encodable {
            let email: String
            let password: String
            let product: String?
        }
        return APIEndpoint(
            path: "/api/auth/sign-in",
            method: .post,
            body: Body(email: email, password: password, product: product)
        )
    }

    static func verifyCode(_ code: String) -> APIEndpoint {
        struct Body: Encodable { let code: String }
        return APIEndpoint(path: "/api/auth/verify-code", method: .post, body: Body(code: code))
    }

    static func resendCode() -> APIEndpoint {
        APIEndpoint(path: "/api/auth/resend-code", method: .post)
    }

    static func forgotPassword(email: String) -> APIEndpoint {
        struct Body: Encodable { let email: String }
        return APIEndpoint(path: "/api/auth/forgot-password", method: .post, body: Body(email: email))
    }

    static func verifyResetCode(_ code: String) -> APIEndpoint {
        struct Body: Encodable { let code: String }
        return APIEndpoint(path: "/api/auth/verify-reset-code", method: .post, body: Body(code: code))
    }

    static func setNewPassword(_ password: String) -> APIEndpoint {
        struct Body: Encodable { let password: String }
        return APIEndpoint(path: "/api/auth/set-new-password", method: .post, body: Body(password: password))
    }

    static var me: APIEndpoint {
        APIEndpoint(path: "/api/auth/me")
    }

    static var signOut: APIEndpoint {
        APIEndpoint(path: "/api/auth/sign-out", method: .post)
    }
}

// MARK: - Contact Endpoints

enum ContactEndpoints {
    static var list: APIEndpoint {
        APIEndpoint(path: "/api/contacts")
    }

    static func create(_ contact: CreateContactBody) -> APIEndpoint {
        APIEndpoint(path: "/api/contacts", method: .post, body: contact)
    }

    static func updateAction(contactId: String, action: UpdateActionBody) -> APIEndpoint {
        APIEndpoint(path: "/api/contacts/\(contactId)/action", method: .post, body: action)
    }

    static func getMatch(contactId: String) -> APIEndpoint {
        APIEndpoint(path: "/api/contacts/\(contactId)/match")
    }

    static func confirmMatch(contactId: String, body: ConfirmMatchBody) -> APIEndpoint {
        APIEndpoint(path: "/api/contacts/\(contactId)/match", method: .put, body: body)
    }

    static func delete(contactId: String) -> APIEndpoint {
        APIEndpoint(
            path: "/api/contacts",
            method: .delete,
            queryItems: [URLQueryItem(name: "contactId", value: contactId)]
        )
    }
}

// MARK: - Match Endpoints

enum MatchEndpoints {
    static func match(_ body: MatchRequestBody) -> APIEndpoint {
        APIEndpoint(path: "/api/match", method: .post, body: body)
    }

    static func nearby(address: String? = nil, zip: String? = nil, state: String, limit: Int = 50) -> APIEndpoint {
        struct Body: Encodable {
            let address: String?
            let zip: String?
            let state: String
            let limit: Int
        }
        return APIEndpoint(
            path: "/api/nearby",
            method: .post,
            body: Body(address: address, zip: zip, state: state, limit: limit)
        )
    }
}

// MARK: - Chat Endpoints

enum ChatEndpoints {
    static func send(message: String, history: [[String: String]]? = nil) -> APIEndpoint {
        struct Body: Encodable {
            let message: String
            let history: [[String: String]]?
        }
        return APIEndpoint(path: "/api/ai/chat", method: .post, body: Body(message: message, history: history))
    }

    static var history: APIEndpoint {
        APIEndpoint(path: "/api/ai/history")
    }
}

// MARK: - Campaign Endpoints

enum CampaignEndpoints {
    static var config: APIEndpoint {
        APIEndpoint(path: "/api/campaign/config")
    }
}

// MARK: - Admin Endpoints

enum AdminEndpoints {
    static var volunteers: APIEndpoint {
        APIEndpoint(path: "/api/admin/volunteers")
    }

    static func createContacts(_ body: AdminCreateContactsBody) -> APIEndpoint {
        APIEndpoint(path: "/api/admin/contacts", method: .post, body: body)
    }
}

struct AdminCreateContactsBody: Encodable {
    let targetUserId: String
    let contacts: [AdminContactInput]
}

struct AdminContactInput: Encodable {
    let firstName: String
    let lastName: String
    let phone: String?
    let city: String?
    let address: String?
    let zip: String?
    let category: String
    let contactOutcome: String?
    let volunteerInterest: String?
}

// MARK: - Request Bodies

struct CreateContactBody: Encodable {
    let firstName: String
    let lastName: String
    let phone: String?
    let address: String?
    let city: String?
    let zip: String?
    let age: Int?
    let ageRange: String?
    let gender: String?
    let category: String
    let contactOutcome: String?
    let volunteerInterest: String?
}

struct UpdateActionBody: Encodable {
    let contacted: Bool?
    let outreachMethod: String?
    let contactOutcome: String?
    let notes: String?
    let volunteerInterest: String?
    let surveyResponses: [String: String]?
    let followUpDate: String?
}

struct DeleteContactBody: Encodable {
    let contactId: String
}

struct ConfirmMatchBody: Encodable {
    let status: String
    let selectedIndex: Int?
}

struct MatchRequestBody: Encodable {
    let people: [PersonEntryRequest]
    let state: String
}

struct PersonEntryRequest: Encodable {
    let id: String
    let firstName: String
    let lastName: String
    let phone: String?
    let address: String?
    let city: String?
    let zip: String?
    let age: Int?
    let ageRange: String?
    let gender: String?
    let category: String
}
