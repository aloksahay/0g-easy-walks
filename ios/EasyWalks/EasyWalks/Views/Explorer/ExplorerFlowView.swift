import SwiftUI

struct ExplorerFlowView: View {
    @StateObject private var vm = ExplorerViewModel()
    @State private var showRoutePreview = false

    var body: some View {
        NavigationStack {
            PreferencesView(vm: vm, onGenerate: {
                Task {
                    await vm.generateRoute()
                    if vm.generatedRoute != nil {
                        showRoutePreview = true
                    }
                }
            })
            .navigationTitle("Plan a Walk")
            .navigationBarTitleDisplayMode(.large)
            .navigationDestination(isPresented: $showRoutePreview) {
                if let route = vm.generatedRoute {
                    RoutePreviewView(vm: vm, route: route)
                }
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .purchaseConfirmNeeded)) { note in
            if let txHash = note.userInfo?["txHash"] as? String {
                Task { await vm.confirmPurchase(txHash: txHash) }
            }
        }
    }
}
