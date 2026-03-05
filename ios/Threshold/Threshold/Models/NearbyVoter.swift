import Foundation

// MARK: - Nearby Response

struct NearbyResponse: Codable {
    let voters: [SafeVoterRecord]
    let total: Int?
    let hasMore: Bool?
    let address: String?
    let zip: String?
    let centerLat: Double?
    let centerLng: Double?
}
