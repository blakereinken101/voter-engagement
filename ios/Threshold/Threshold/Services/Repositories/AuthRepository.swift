import Foundation

final class AuthRepository {
    private let client = APIClient.shared

    func signIn(email: String, password: String) async throws -> SignInResponse {
        try await client.request(AuthEndpoints.signIn(email: email, password: password, product: "relational"))
    }

    func verifyCode(_ code: String) async throws -> VerifyCodeResponse {
        try await client.request(AuthEndpoints.verifyCode(code))
    }

    func resendCode() async throws {
        try await client.requestVoid(AuthEndpoints.resendCode())
    }

    func forgotPassword(email: String) async throws {
        try await client.requestVoid(AuthEndpoints.forgotPassword(email: email))
    }

    func verifyResetCode(_ code: String) async throws {
        try await client.requestVoid(AuthEndpoints.verifyResetCode(code))
    }

    func setNewPassword(_ password: String) async throws {
        try await client.requestVoid(AuthEndpoints.setNewPassword(password))
    }

    func fetchMe() async throws -> MeResponse {
        try await client.request(AuthEndpoints.me)
    }

    func signOut() async throws {
        try await client.requestVoid(AuthEndpoints.signOut)
    }
}
