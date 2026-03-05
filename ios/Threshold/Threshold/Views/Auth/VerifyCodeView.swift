import SwiftUI

struct VerifyCodeView: View {
    @Environment(AuthViewModel.self) private var auth

    var body: some View {
        @Bindable var auth = auth

        ZStack {
            Color.vcBg.ignoresSafeArea()

            VStack(spacing: 32) {
                Spacer()

                // Icon
                Image(systemName: "lock.shield.fill")
                    .font(.system(size: 48))
                    .foregroundStyle(Color.vcPurple)

                VStack(spacing: 8) {
                    Text("Check your email")
                        .font(.title2.bold())
                        .foregroundStyle(.white)

                    Text("We sent a 6-digit code to \(auth.email)")
                        .font(.subheadline)
                        .foregroundStyle(Color.vcSlate)
                        .multilineTextAlignment(.center)
                }

                // Code Input
                VStack(spacing: 16) {
                    TextField("000000", text: $auth.verificationCode)
                        .textFieldStyle(.plain)
                        .keyboardType(.numberPad)
                        .textContentType(.oneTimeCode)
                        .multilineTextAlignment(.center)
                        .font(.system(size: 32, weight: .bold, design: .monospaced))
                        .padding(16)
                        .background(Color.vcBgCard)
                        .cornerRadius(12)
                        .foregroundStyle(.white)
                        .onChange(of: auth.verificationCode) { _, newValue in
                            // Auto-submit when 6 digits entered
                            let filtered = String(newValue.prefix(6).filter(\.isNumber))
                            auth.verificationCode = filtered
                            if filtered.count == 6 {
                                Task { await auth.verifyCode() }
                            }
                        }

                    if let error = auth.error {
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(Color.vcCoral)
                    }

                    Button {
                        Task { await auth.verifyCode() }
                    } label: {
                        HStack {
                            if auth.isLoading {
                                ProgressView()
                                    .progressViewStyle(.circular)
                                    .tint(.white)
                            }
                            Text("Verify")
                                .fontWeight(.semibold)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(14)
                        .background(Color.vcPurple)
                        .foregroundStyle(.white)
                        .cornerRadius(10)
                    }
                    .disabled(auth.isLoading || auth.verificationCode.count < 6)

                    // Resend
                    Button {
                        Task { await auth.resendCode() }
                    } label: {
                        if auth.resendCooldown > 0 {
                            Text("Resend code in \(auth.resendCooldown)s")
                                .foregroundStyle(Color.vcSlate)
                        } else {
                            Text("Resend code")
                                .foregroundStyle(Color.vcPurpleLight)
                        }
                    }
                    .font(.subheadline)
                    .disabled(auth.resendCooldown > 0)
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
}
