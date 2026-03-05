import Foundation

@Observable
final class TokenManager {
    static let shared = TokenManager()
    private let keychain = KeychainHelper.shared

    var sessionToken: String? {
        get { keychain.read(key: AppConstants.keychainSessionToken) }
        set {
            if let newValue {
                keychain.save(key: AppConstants.keychainSessionToken, value: newValue)
            } else {
                keychain.delete(key: AppConstants.keychainSessionToken)
            }
        }
    }

    var pendingToken: String? {
        get { keychain.read(key: AppConstants.keychainPendingToken) }
        set {
            if let newValue {
                keychain.save(key: AppConstants.keychainPendingToken, value: newValue)
            } else {
                keychain.delete(key: AppConstants.keychainPendingToken)
            }
        }
    }

    var activeCampaignId: String? {
        get { UserDefaults.standard.string(forKey: AppConstants.activeCampaignId) }
        set { UserDefaults.standard.set(newValue, forKey: AppConstants.activeCampaignId) }
    }

    var hasSession: Bool {
        sessionToken != nil
    }

    func clearAll() {
        sessionToken = nil
        pendingToken = nil
        activeCampaignId = nil
    }
}
