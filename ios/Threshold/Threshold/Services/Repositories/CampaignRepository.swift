import Foundation

final class CampaignRepository {
    private let client = APIClient.shared

    func fetchConfig() async throws -> CampaignConfig {
        try await client.request(CampaignEndpoints.config)
    }
}
