import Foundation

final class NearbyRepository {
    private let client = APIClient.shared

    func fetchNearby(address: String? = nil, zip: String? = nil, state: String, limit: Int = 50, offset: Int = 0) async throws -> NearbyResponse {
        try await client.request(MatchEndpoints.nearby(address: address, zip: zip, state: state, limit: limit, offset: offset))
    }
}
