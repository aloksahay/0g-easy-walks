import SwiftUI

@main
struct EasyWalksApp: App {
    @StateObject private var walletService = WalletService.shared

    var body: some Scene {
        WindowGroup {
            if walletService.isConnected {
                MainTabView()
                    .onOpenURL { url in
                        handleDeepLink(url)
                    }
            } else {
                ConnectWalletView()
            }
        }
    }

    /// Handle MetaMask callback deep links (easywalkss://)
    private func handleDeepLink(_ url: URL) {
        guard url.scheme == "easywalkss" else { return }

        if url.host == "sign-callback" {
            // Parse signature from query params if MetaMask passes it back
            // Otherwise user pastes it manually
        } else if url.host == "purchase-callback" {
            let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
            if let txHash = components?.queryItems?.first(where: { $0.name == "txHash" })?.value {
                NotificationCenter.default.post(
                    name: .purchaseConfirmNeeded,
                    object: nil,
                    userInfo: ["txHash": txHash]
                )
            }
        }
    }
}

extension Notification.Name {
    static let purchaseConfirmNeeded = Notification.Name("purchaseConfirmNeeded")
}
