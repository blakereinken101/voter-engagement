import SwiftUI

struct SignInView: View {
    @Environment(AuthViewModel.self) private var auth
    @State private var appeared = false

    var body: some View {
        @Bindable var auth = auth

        NavigationStack {
            ZStack {
                CosmicBackground()
                ShootingStarView()

                ScrollView {
                    VStack(spacing: 32) {
                        // Logo
                        Image("logo")
                            .resizable()
                            .scaledToFit()
                            .frame(height: 180)
                            .shadow(color: Color.vcPurple.opacity(0.5), radius: 30)
                            .padding(.top, 60)

                        // Form card
                        VStack(spacing: 16) {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Email")
                                    .font(.caption)
                                    .foregroundStyle(Color.vcSlate)

                                TextField("you@example.com", text: $auth.email)
                                    .textFieldStyle(.plain)
                                    .keyboardType(.emailAddress)
                                    .textContentType(.emailAddress)
                                    .autocapitalization(.none)
                                    .disableAutocorrection(true)
                                    .glassInput()
                            }

                            VStack(alignment: .leading, spacing: 8) {
                                Text("Password")
                                    .font(.caption)
                                    .foregroundStyle(Color.vcSlate)

                                SecureField("Password", text: $auth.password)
                                    .textFieldStyle(.plain)
                                    .textContentType(.password)
                                    .glassInput()
                            }

                            if let error = auth.error {
                                Text(error)
                                    .font(.caption)
                                    .foregroundStyle(Color.vcCoral)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }

                            Button {
                                Task { await auth.signIn() }
                            } label: {
                                HStack {
                                    if auth.isLoading {
                                        ProgressView()
                                            .progressViewStyle(.circular)
                                            .tint(.white)
                                    }
                                    Text("Sign In")
                                        .fontWeight(.semibold)
                                }
                                .frame(maxWidth: .infinity)
                                .padding(14)
                                .background(Color.vcPurple)
                                .foregroundStyle(.white)
                                .cornerRadius(10)
                                .shadow(color: Color.vcPurple.opacity(0.3), radius: 12)
                            }
                            .disabled(auth.isLoading)

                            Button("Forgot password?") {
                                auth.goToForgotPassword()
                            }
                            .font(.subheadline)
                            .foregroundStyle(Color.vcPurpleLight)
                        }
                        .padding(24)
                        .glassCard()
                        .padding(.horizontal, 20)
                    }
                    .opacity(appeared ? 1 : 0)
                    .offset(y: appeared ? 0 : 16)
                }
            }
            .navigationBarHidden(true)
            .onAppear {
                withAnimation(.easeOut(duration: 0.5)) {
                    appeared = true
                }
            }
        }
    }
}
