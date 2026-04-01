import Foundation
import UIKit
import CryptoKit

/// Lightweight wallet integration using MetaMask mobile deep links.
/// No WalletConnect SDK required — keeps the MVP simple.
@MainActor
class WalletService: ObservableObject {
    static let shared = WalletService()

    @Published var walletAddress: String?
    @Published var isConnected: Bool = false

    private let walletKey = "connected_wallet"

    private init() {
        // Restore session
        walletAddress = UserDefaults.standard.string(forKey: walletKey)
        isConnected = walletAddress != nil
    }

    /// Open MetaMask to sign a personal_sign message.
    /// MetaMask will deep-link back to the app after signing.
    /// Callback URL scheme must be registered: easywalkss://
    func requestSignature(
        walletAddress: String,
        message: String,
        callbackScheme: String = "easywalkss"
    ) {
        // Hex-encode message for MetaMask
        let hexMessage = message.data(using: .utf8)!
            .map { String(format: "%02x", $0) }
            .joined()
            .prepending("0x")

        // MetaMask deep link: opens sign screen, returns to app
        let encodedMsg = hexMessage.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? hexMessage
        let encodedAddress = walletAddress.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? walletAddress
        let callbackURL = "\(callbackScheme)://sign-callback"
        let encodedCallback = callbackURL.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? callbackURL

        let mmURL = "metamask://personal_sign?message=\(encodedMsg)&address=\(encodedAddress)&callback=\(encodedCallback)"

        if let url = URL(string: mmURL) {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
        }
    }

    /// Build a MetaMask deep link to send a transaction.
    /// Returns the URL so the caller can open it.
    func buildSendTxURL(
        to: String,
        value: String, // hex string e.g. "0xDE0B6B3A7640000"
        data: String,  // hex calldata
        chainId: Int = 16602
    ) -> URL? {
        let encodedTo = to.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? to
        let encodedData = data.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? data
        let encodedValue = value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? value

        let urlStr = "metamask://send?to=\(encodedTo)&value=\(encodedValue)&data=\(encodedData)&chainId=\(chainId)"
        return URL(string: urlStr)
    }

    func setWallet(_ address: String) {
        walletAddress = address.lowercased()
        isConnected = true
        UserDefaults.standard.set(walletAddress, forKey: walletKey)
    }

    func disconnect() {
        walletAddress = nil
        isConnected = false
        UserDefaults.standard.removeObject(forKey: walletKey)
        Task { await APIClient.shared.clearToken() }
    }

    /// Convert wei (as decimal string) to OG for display
    static func weiToOG(_ wei: String) -> String {
        guard let weiValue = Double(wei) else { return "?" }
        let og = weiValue / 1e18
        if og < 0.001 {
            return String(format: "%.6f OG", og)
        }
        return String(format: "%.4f OG", og)
    }
}

private extension String {
    func prepending(_ prefix: String) -> String {
        prefix + self
    }
}
