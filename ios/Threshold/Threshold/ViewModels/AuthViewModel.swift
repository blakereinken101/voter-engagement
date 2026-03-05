import Foundation
import os

private let logger = Logger(subsystem: "com.thresholdvote.app", category: "AuthVM")

@Observable
final class AuthViewModel {
    // MARK: - State

    enum AuthStep {
        case signIn
        case verifyCode
        case forgotPassword
        case resetCode
        case newPassword
    }

    var step: AuthStep = .signIn
    var isAuthenticated = false
    var isLoading = false
    var isCheckingSession = true
    var error: String?

    var user: User?
    var memberships: [Membership] = []
    var activeMembership: Membership?
    var campaignConfig: CampaignConfig?

    var isAdmin: Bool {
        guard let user else { return false }
        if user.isPlatformAdmin { return true }
        guard let memberRole = MembershipRole(rawValue: activeMembership?.role ?? "") else { return false }
        return [.platformAdmin, .orgOwner, .campaignAdmin].contains(memberRole)
    }

    // Form fields
    var email = ""
    var password = ""
    var verificationCode = ""
    var newPassword = ""

    // Resend cooldown
    var resendCooldown = 0

    // MARK: - Private

    private let authRepo = AuthRepository()
    private let campaignRepo = CampaignRepository()
    private let tokenManager = TokenManager.shared
    private var resendTimer: Timer?

    // MARK: - Lifecycle

    /// Check for existing session on app launch.
    func checkExistingSession() async {
        guard tokenManager.hasSession else {
            isCheckingSession = false
            return
        }

        do {
            let me = try await authRepo.fetchMe()

            // Save refreshed token from server to extend the session
            if let refreshedToken = me.sessionToken {
                tokenManager.sessionToken = refreshedToken
            }

            user = me.user
            memberships = me.memberships

            // Sync activeMembership with locally stored campaign ID
            if let localCampaignId = tokenManager.activeCampaignId,
               let localMembership = memberships.first(where: { $0.campaignId == localCampaignId }) {
                // Use the locally stored campaign (survives app restarts)
                activeMembership = localMembership
            } else if let apiActive = me.activeMembership {
                // Fall back to what the API says
                activeMembership = apiActive
                tokenManager.activeCampaignId = apiActive.campaignId
            } else if let first = memberships.first {
                // Last resort: use first membership
                activeMembership = first
                tokenManager.activeCampaignId = first.campaignId
            }

            logger.notice("Loaded \(self.memberships.count) memberships, active: \(self.activeMembership?.campaignName ?? "nil", privacy: .public) (\(self.activeMembership?.campaignId ?? "nil", privacy: .public))")

            // Load campaign config
            if tokenManager.activeCampaignId != nil {
                campaignConfig = try? await campaignRepo.fetchConfig()
            }

            isAuthenticated = true
        } catch {
            // Token expired or invalid
            tokenManager.clearAll()
        }

        isCheckingSession = false
    }

    // MARK: - Sign In

    func signIn() async {
        guard !email.isEmpty, !password.isEmpty else {
            self.error = "Email and password are required"
            return
        }

        isLoading = true
        error = nil

        do {
            let response = try await authRepo.signIn(email: email.lowercased().trimmingCharacters(in: .whitespaces), password: password)

            if response.requiresVerification == true {
                // Store pending token for mobile 2FA
                if let pendingToken = response.pendingToken {
                    tokenManager.pendingToken = pendingToken
                }
                step = .verifyCode
                startResendCooldown()
            }
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    // MARK: - Verify 2FA Code

    func verifyCode() async {
        let code = verificationCode.trimmingCharacters(in: .whitespaces)
        guard code.count == 6, code.allSatisfy(\.isNumber) else {
            error = "Please enter a valid 6-digit code"
            return
        }

        isLoading = true
        error = nil

        do {
            let response = try await authRepo.verifyCode(code)

            // Store session token from mobile response
            if let sessionToken = response.sessionToken {
                tokenManager.sessionToken = sessionToken
            }
            if let campaignId = response.campaignId {
                tokenManager.activeCampaignId = campaignId
            }

            // Clear pending token
            tokenManager.pendingToken = nil

            user = response.user
            memberships = response.memberships ?? []
            activeMembership = response.activeMembership

            // Load campaign config
            if tokenManager.activeCampaignId != nil {
                campaignConfig = try? await campaignRepo.fetchConfig()
            }

            isAuthenticated = true
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    // MARK: - Resend Code

    func resendCode() async {
        guard resendCooldown == 0 else { return }

        do {
            try await authRepo.resendCode()
            startResendCooldown()
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - Forgot Password

    func forgotPassword() async {
        guard !email.isEmpty else {
            error = "Please enter your email"
            return
        }

        isLoading = true
        error = nil

        do {
            try await authRepo.forgotPassword(email: email.lowercased().trimmingCharacters(in: .whitespaces))
            step = .resetCode
            startResendCooldown()
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    func verifyResetCode() async {
        let code = verificationCode.trimmingCharacters(in: .whitespaces)
        guard code.count == 6 else {
            error = "Please enter a valid 6-digit code"
            return
        }

        isLoading = true
        error = nil

        do {
            try await authRepo.verifyResetCode(code)
            step = .newPassword
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    func setNewPassword() async {
        guard newPassword.count >= 8 else {
            error = "Password must be at least 8 characters"
            return
        }

        isLoading = true
        error = nil

        do {
            try await authRepo.setNewPassword(newPassword)
            // Return to sign-in
            step = .signIn
            password = ""
            verificationCode = ""
            self.newPassword = ""
            error = nil
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    // MARK: - Switch Campaign

    /// Synchronous campaign switch — updates local state immediately.
    /// Call this from CampaignPickerView so the mutation happens before dismiss.
    func performCampaignSwitch(to campaignId: String) {
        logger.notice("performCampaignSwitch: \(self.tokenManager.activeCampaignId ?? "nil", privacy: .public) → \(campaignId, privacy: .public)")
        tokenManager.activeCampaignId = campaignId
        activeMembership = memberships.first { $0.campaignId == campaignId }
        campaignConfig = nil  // Clear stale config so header shows new campaign name immediately
        logger.notice("activeMembership is now: \(self.activeMembership?.campaignName ?? "nil", privacy: .public)")
    }

    func switchCampaign(to campaignId: String) async {
        performCampaignSwitch(to: campaignId)
        campaignConfig = try? await campaignRepo.fetchConfig()
    }

    /// Reload just the campaign config (used after picker sets the campaign ID directly)
    func reloadCampaignConfig() async {
        campaignConfig = try? await campaignRepo.fetchConfig()
    }

    // MARK: - Sign Out

    func signOut() {
        tokenManager.clearAll()
        user = nil
        memberships = []
        activeMembership = nil
        campaignConfig = nil
        isAuthenticated = false
        step = .signIn
        email = ""
        password = ""
        verificationCode = ""
        error = nil
    }

    // MARK: - Navigation

    func goToForgotPassword() {
        error = nil
        verificationCode = ""
        step = .forgotPassword
    }

    func backToSignIn() {
        error = nil
        verificationCode = ""
        step = .signIn
    }

    // MARK: - Private Helpers

    private func startResendCooldown() {
        resendCooldown = 60
        resendTimer?.invalidate()
        resendTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] timer in
            guard let self else { timer.invalidate(); return }
            if self.resendCooldown > 0 {
                self.resendCooldown -= 1
            } else {
                timer.invalidate()
            }
        }
    }
}
