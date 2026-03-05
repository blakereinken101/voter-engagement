import SwiftUI

@main
struct ThresholdApp: App {
    @State private var authVM = AuthViewModel()
    @State private var contactsVM = ContactsViewModel()
    @State private var chatVM = ChatViewModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(authVM)
                .environment(contactsVM)
                .environment(chatVM)
                .preferredColorScheme(.dark)
        }
    }
}

// MARK: - Root View

struct RootView: View {
    @Environment(AuthViewModel.self) private var auth

    var body: some View {
        Group {
            if auth.isCheckingSession {
                LaunchScreenView()
            } else if auth.isAuthenticated {
                MainTabView()
            } else {
                AuthFlowView()
            }
        }
        .task {
            await auth.checkExistingSession()
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
