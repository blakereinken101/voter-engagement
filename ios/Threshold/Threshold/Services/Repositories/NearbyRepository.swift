import Foundation

final class NearbyRepository {
    private let client = APIClient.shared

    func fetchNearby(address: String? = nil, zip: String? = nil, state: String) async throws -> NearbyResponse {
        try await client.request(MatchEndpoints.nearby(address: address, zip: zip, state: state))
    }
}
