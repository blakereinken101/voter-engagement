import Foundation
import UserNotifications
import UIKit

@Observable
final class PushNotificationManager: NSObject {
    static let shared = PushNotificationManager()

    var isRegistered = false
    var permissionStatus: UNAuthorizationStatus = .notDetermined

    private let client = APIClient.shared

    private override init() {
        super.init()
    }

    /// Request notification permission and register for remote notifications.
    /// Call this after the user is authenticated.
    func requestPermissionAndRegister() async {
        let center = UNUserNotificationCenter.current()

        // Check current status first
        let settings = await center.notificationSettings()
        permissionStatus = settings.authorizationStatus

        guard settings.authorizationStatus != .denied else {
            print("[Push] Notifications denied by user")
            return
        }

        do {
            let granted = try await center.requestAuthorization(options: [.alert, .badge, .sound])
            if granted {
                await MainActor.run {
                    UIApplication.shared.registerForRemoteNotifications()
                }
                print("[Push] Permission granted, registering for remote notifications")
            } else {
                print("[Push] Permission not granted")
            }
        } catch {
            print("[Push] Permission request failed: \(error)")
        }

        // Refresh status
        let updatedSettings = await center.notificationSettings()
        permissionStatus = updatedSettings.authorizationStatus
    }

    /// Called by AppDelegate when device token is received from APNs.
    func handleDeviceToken(_ tokenData: Data) {
        let token = tokenData.map { String(format: "%02x", $0) }.joined()
        print("[Push] Device token: \(token)")

        Task {
            await registerTokenWithServer(token)
        }
    }

    /// Called by AppDelegate when registration fails.
    func handleRegistrationError(_ error: Error) {
        print("[Push] Registration failed: \(error.localizedDescription)")
    }

    // MARK: - Private

    private func registerTokenWithServer(_ token: String) async {
        do {
            try await client.requestVoid(
                PushEndpoints.registerDevice(token: token)
            )
            isRegistered = true
            print("[Push] Token registered with server")
        } catch {
            print("[Push] Server registration failed: \(error.localizedDescription)")
        }
    }
}
