import Foundation

final class ContactRepository {
    private let client = APIClient.shared

    func fetchContacts() async throws -> ContactsResponse {
        try await client.request(ContactEndpoints.list)
    }

    func createContact(_ body: CreateContactBody) async throws -> PersonEntry {
        try await client.request(ContactEndpoints.create(body))
    }

    func updateAction(contactId: String, action: UpdateActionBody) async throws {
        try await client.requestVoid(ContactEndpoints.updateAction(contactId: contactId, action: action))
    }

    func getMatchCandidates(contactId: String) async throws -> [MatchCandidate] {
        try await client.request(ContactEndpoints.getMatch(contactId: contactId))
    }

    func confirmMatch(contactId: String, status: String, selectedIndex: Int?) async throws {
        let body = ConfirmMatchBody(status: status, selectedIndex: selectedIndex)
        try await client.requestVoid(ContactEndpoints.confirmMatch(contactId: contactId, body: body))
    }

    func deleteContact(contactId: String) async throws {
        try await client.requestVoid(ContactEndpoints.delete(contactId: contactId))
    }
}
