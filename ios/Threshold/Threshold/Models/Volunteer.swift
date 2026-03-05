import Foundation

struct VolunteerInfo: Codable, Identifiable {
    let id: String
    let name: String
    let email: String
}

struct VolunteersResponse: Codable {
    let volunteers: [VolunteerInfo]
}
