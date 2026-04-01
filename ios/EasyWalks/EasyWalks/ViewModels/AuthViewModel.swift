import Foundation
import SwiftUI

@MainActor
class AuthViewModel: ObservableObject {
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var pendingChallenge: String?
    @Published var enteredAddress: String = ""
    @Published var enteredSignature: String = ""

    let walletService = WalletService.shared

    func requestChallenge() async {
        let address = enteredAddress.trimmingCharacters(in: .whitespaces)
        guard address.hasPrefix("0x"), address.count == 42 else {
            errorMessage = "Enter a valid Ethereum address (0x...)"
            return
        }

        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let response = try await APIClient.shared.getChallenge(walletAddress: address)
            pendingChallenge = response.challenge
            // Open MetaMask to sign
            walletService.requestSignature(walletAddress: address, message: response.challenge)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func verifySignature() async {
        guard let challenge = pendingChallenge else { return }
        let signature = enteredSignature.trimmingCharacters(in: .whitespaces)
        guard !signature.isEmpty else {
            errorMessage = "Paste the signature from MetaMask"
            return
        }

        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let response = try await APIClient.shared.verifySignature(
                walletAddress: enteredAddress,
                signature: signature,
                challenge: challenge
            )
            await APIClient.shared.setToken(response.token)
            walletService.setWallet(enteredAddress)
            pendingChallenge = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
