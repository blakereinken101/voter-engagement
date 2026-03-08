import SwiftUI
import UserNotifications

@main
struct ThresholdApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @State private var authVM = AuthViewModel()
    @State private var contactsVM = ContactsViewModel()
    @State private var chatVM = ChatViewModel()
    @State private var messagingVM = MessagingViewModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(authVM)
                .environment(contactsVM)
                .environment(chatVM)
                .environment(messagingVM)
                .preferredColorScheme(.dark)
        }
    }
}

// MARK: - App Delegate (Push Notifications)

class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        PushNotificationManager.shared.handleDeviceToken(deviceToken)
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        PushNotificationManager.shared.handleRegistrationError(error)
    }

    // Show notifications even when the app is in the foreground
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .badge, .sound])
    }

    // Handle notification tap
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        // Future: handle deep linking based on notification payload
        completionHandler()
    }
}

// MARK: - Root View

struct RootView: View {
    @Environment(AuthViewModel.self) private var auth
    @State private var minimumTimeElapsed = false

    var body: some View {
        Group {
            if auth.isCheckingSession || !minimumTimeElapsed {
                LaunchScreenView()
            } else if auth.isAuthenticated {
                MainTabView()
            } else {
                AuthFlowView()
            }
        }
        .task {
            // Run session check and minimum splash delay in parallel
            async let sessionCheck: () = auth.checkExistingSession()
            async let delay: () = Task.sleep(for: .seconds(2))

            await sessionCheck
            _ = try? await delay
            minimumTimeElapsed = true
        }
        .onChange(of: auth.isAuthenticated) { _, isAuthenticated in
            if isAuthenticated {
                Task {
                    await PushNotificationManager.shared.requestPermissionAndRegister()
                }
            }
        }
    }
}

// MARK: - Launch Screen

struct LaunchScreenView: View {
    @State private var logoScale: CGFloat = 0.8
    @State private var logoOpacity: Double = 0

    var body: some View {
        ZStack {
            CosmicBackground()
            ShootingStarView()

            VStack(spacing: 16) {
                Image("logo")
                    .resizable()
                    .scaledToFit()
                    .frame(height: 160)
                    .shadow(color: Color.vcPurple.opacity(0.5), radius: 30)
                    .scaleEffect(logoScale)
                    .opacity(logoOpacity)

                ProgressView()
                    .progressViewStyle(.circular)
                    .tint(Color.vcPurple)
                    .opacity(logoOpacity)
            }
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.8)) {
                logoScale = 1.0
                logoOpacity = 1.0
            }
        }
    }
}

// MARK: - Auth Flow

struct AuthFlowView: View {
    @Environment(AuthViewModel.self) private var auth

    var body: some View {
        switch auth.step {
        case .signIn:
            SignInView()
        case .verifyCode:
            VerifyCodeView()
        case .forgotPassword, .resetCode, .newPassword:
            ForgotPasswordView()
        }
    }
}
