import SwiftUI

struct ConnectWalletView: View {
    @StateObject private var vm = AuthViewModel()
    @State private var showSignatureInput = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 32) {
                Spacer()

                // Logo
                VStack(spacing: 8) {
                    Text("🚶")
                        .font(.system(size: 64))
                    Text("EasyWalks")
                        .font(.largeTitle.bold())
                    Text("Discover cities on foot")
                        .foregroundStyle(.secondary)
                }

                Spacer()

                // Wallet address input
                VStack(alignment: .leading, spacing: 8) {
                    Text("Your Wallet Address")
                        .font(.subheadline.weight(.medium))

                    TextField("0x...", text: $vm.enteredAddress)
                        .textFieldStyle(.roundedBorder)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .font(.system(.body, design: .monospaced))
                }
                .padding(.horizontal)

                if let challenge = vm.pendingChallenge {
                    // Step 2: show challenge and signature input
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Sign this message in MetaMask, then paste the signature below:")
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        Text(challenge)
                            .font(.system(.caption, design: .monospaced))
                            .padding(8)
                            .background(.quaternary)
                            .cornerRadius(8)

                        TextField("Paste signature (0x...)", text: $vm.enteredSignature, axis: .vertical)
                            .textFieldStyle(.roundedBorder)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .lineLimit(3...6)
                            .font(.system(.caption, design: .monospaced))

                        Button {
                            Task { await vm.verifySignature() }
                        } label: {
                            Label("Verify & Sign In", systemImage: "checkmark.shield")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(vm.isLoading || vm.enteredSignature.isEmpty)
                    }
                    .padding(.horizontal)
                } else {
                    // Step 1: request challenge
                    Button {
                        Task { await vm.requestChallenge() }
                    } label: {
                        if vm.isLoading {
                            ProgressView()
                                .frame(maxWidth: .infinity)
                        } else {
                            Label("Connect with MetaMask", systemImage: "wallet.pass")
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(vm.isLoading || vm.enteredAddress.isEmpty)
                    .padding(.horizontal)
                }

                if let error = vm.errorMessage {
                    Text(error)
                        .foregroundStyle(.red)
                        .font(.caption)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }

                Spacer()
            }
        }
    }
}
