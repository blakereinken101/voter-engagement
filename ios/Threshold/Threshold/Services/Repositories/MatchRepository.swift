import Foundation

final class MatchRepository {
    private let client = APIClient.shared

    func runMatching(people: [PersonEntry], state: String) async throws -> MatchResponseBody {
        let entries = people.map { p in
            PersonEntryRequest(
                id: p.id,
                firstName: p.firstName,
                lastName: p.lastName,
                phone: p.phone,
                address: p.address,
                city: p.city,
                zip: p.zip,
                age: p.age,
                ageRange: p.ageRange,
                gender: p.gender,
                category: p.category.rawValue
            )
        }
        let body = MatchRequestBody(people: entries, state: state)
        return try await client.request(MatchEndpoints.match(body))
    }
}
