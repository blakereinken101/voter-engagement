import Foundation

enum AppConstants {
    // MARK: - API
    static let apiBaseURL = URL(string: "https://thresholdvote.com")!

    // MARK: - Keychain Keys
    static let keychainSessionToken = "vc-session-token"
    static let keychainPendingToken = "vc-2fa-pending-token"

    // MARK: - UserDefaults Keys
    static let activeCampaignId = "vc-active-campaign-id"

    // MARK: - Networking
    static let requestTimeout: TimeInterval = 30
    static let mobileClientHeader = "mobile"
}
