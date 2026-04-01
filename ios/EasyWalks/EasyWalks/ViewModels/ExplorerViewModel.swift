import Foundation
import SwiftUI
import MapKit

@MainActor
class ExplorerViewModel: ObservableObject {
    @Published var preferences = WalkPreferences()
    @Published var generatedRoute: GeneratedRoute?
    @Published var isGenerating = false
    @Published var isPurchasing = false
    @Published var purchasedRoute: Route?
    @Published var purchasedRoutes: [Route] = []
    @Published var errorMessage: String?
    @Published var currentStopIndex: Int = 0

    func generateRoute() async {
        guard !preferences.city.isEmpty else {
            errorMessage = "Enter a city name"
            return
        }

        isGenerating = true
        errorMessage = nil
        defer { isGenerating = false }

        let req = GenerateRouteRequest(
            city: preferences.city,
            duration: preferences.duration.rawValue,
            categories: preferences.categories.map(\.rawValue),
            interests: Array(preferences.interests)
        )

        do {
            let response = try await APIClient.shared.generateRoute(req)
            generatedRoute = response.route
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func prepareAndPurchase() async {
        guard let route = generatedRoute else { return }
        isPurchasing = true
        errorMessage = nil
        defer { isPurchasing = false }

        do {
            let prep = try await APIClient.shared.preparePurchase(routeId: route.id)

            // Convert price to hex for MetaMask
            let priceHex = hexString(from: prep.priceWei)

            guard let txURL = WalletService.shared.buildSendTxURL(
                to: prep.contractAddress,
                value: priceHex,
                data: prep.calldata
            ) else {
                errorMessage = "Failed to build transaction URL"
                return
            }

            // Store route ID for confirmation after MetaMask returns
            UserDefaults.standard.set(route.id, forKey: "pending_purchase_route_id")
            await UIApplication.shared.open(txURL)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func confirmPurchase(txHash: String) async {
        guard let routeId = UserDefaults.standard.string(forKey: "pending_purchase_route_id") else {
            return
        }

        do {
            let response = try await APIClient.shared.confirmPurchase(routeId: routeId, txHash: txHash)
            purchasedRoute = response.route
            UserDefaults.standard.removeObject(forKey: "pending_purchase_route_id")
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loadPurchasedRoutes() async {
        do {
            let response = try await APIClient.shared.getPurchasedRoutes()
            purchasedRoutes = response.routes
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    var currentStop: RouteStop? {
        guard let route = generatedRoute,
              currentStopIndex < route.stops.count else { return nil }
        return route.stops[currentStopIndex]
    }

    func nextStop() {
        guard let route = generatedRoute else { return }
        if currentStopIndex < route.stops.count - 1 {
            currentStopIndex += 1
        }
    }

    func previousStop() {
        if currentStopIndex > 0 {
            currentStopIndex -= 1
        }
    }

    // Compute MapKit annotations from route stops
    func mapAnnotations() -> [StopAnnotation] {
        generatedRoute?.stops.enumerated().map { idx, stop in
            StopAnnotation(
                id: stop.contentItem.id,
                title: stop.contentItem.title,
                subtitle: stop.contentItem.category.displayName,
                coordinate: CLLocationCoordinate2D(
                    latitude: stop.contentItem.latitude,
                    longitude: stop.contentItem.longitude
                ),
                order: idx + 1
            )
        } ?? []
    }

    private func hexString(from decimal: String) -> String {
        guard let value = UInt64(decimal) else { return "0x0" }
        return "0x" + String(value, radix: 16)
    }
}

struct StopAnnotation: Identifiable {
    let id: String
    let title: String
    let subtitle: String
    let coordinate: CLLocationCoordinate2D
    let order: Int
}
