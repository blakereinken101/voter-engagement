import SwiftUI

struct ForgotPasswordView: View {
    @Environment(AuthViewModel.self) private var auth

    var body: some View {
        @Bindable var auth = auth

        ZStack {
            Color.vcBg.ignoresSafeArea()

            VStack(spacing: 32) {
                Spacer()

                Image(systemName: "key.fill")
                    .font(.system(size: 48))
                    .foregroundStyle(Color.vcGold)

                Group {
                    switch auth.step {
                    case .forgotPassword:
                        forgotPasswordForm
                    case .resetCode:
                        resetCodeForm
                    case .newPassword:
                        newPasswordForm
                    default:
                        EmptyView()
                    }
                }
                .padding(.horizontal, 24)

                Spacer()

                Button("Back to Sign In") {
                    auth.backToSignIn()
                }
                .font(.subheadline)
                .foregroundStyle(Color.vcSlate)
                .padding(.bottom, 32)
            }
        }
    }

    // MARK: - Email Entry

    private var forgotPasswordForm: some View {
        VStack(spacing: 16) {
            Text("Reset Password")
                .font(.title2.bold())
                .foregroundStyle(.white)

            Text("Enter your email to receive a reset code")
                .font(.subheadline)
                .foregroundStyle(Color.vcSlate)

            TextField("Email", text: Bindable(auth).email)
                .textFieldStyle(.plain)
                .keyboardType(.emailAddress)
                .autocapitalization(.none)
                .padding(12)
                .background(Color.vcBgCard)
                .cornerRadius(10)
                .foregroundStyle(.white)

            errorText

            Button {
                Task { await auth.forgotPassword() }
            } label: {
                loadingButton("Send Reset Code")
            }
            .disabled(auth.isLoading)
        }
    }

    // MARK: - Code Entry

    private var resetCodeForm: some View {
        VStack(spacing: 16) {
            Text("Enter Reset Code")
                .font(.title2.bold())
                .foregroundStyle(.white)

            TextField("000000", text: Bindable(auth).verificationCode)
                .textFieldStyle(.plain)
                .keyboardType(.numberPad)
                .multilineTextAlignment(.center)
                .font(.system(size: 32, weight: .bold, design: .monospaced))
                .padding(16)
                .background(Color.vcBgCard)
                .cornerRadius(12)
                .foregroundStyle(.white)

            errorText

            Button {
                Task { await auth.verifyResetCode() }
            } label: {
                loadingButton("Verify Code")
            }
            .disabled(auth.isLoading)
        }
    }

    // MARK: - New Password

    private var newPasswordForm: some View {
        VStack(spacing: 16) {
            Text("New Password")
                .font(.title2.bold())
                .foregroundStyle(.white)

            SecureField("Minimum 8 characters", text: Bindable(auth).newPassword)
                .textFieldStyle(.plain)
                .padding(12)
                .background(Color.vcBgCard)
                .cornerRadius(10)
                .foregroundStyle(.white)

            errorText

            Button {
                Task { await auth.setNewPassword() }
            } label: {
                loadingButton("Set Password")
            }
            .disabled(auth.isLoading)
        }
    }

    // MARK: - Helpers

    @ViewBuilder
    private var errorText: some View {
        if let error = auth.error {
            Text(error)
                .font(.caption)
                .foregroundStyle(Color.vcCoral)
        }
    }

    private func loadingButton(_ title: String) -> some View {
        HStack {
            if auth.isLoading {
                ProgressView().tint(.white)
            }
            Text(title).fontWeight(.semibold)
        }
        .frame(maxWidth: .infinity)
        .padding(14)
        .background(Color.vcPurple)
        .foregroundStyle(.white)
        .cornerRadius(10)
    }
}
