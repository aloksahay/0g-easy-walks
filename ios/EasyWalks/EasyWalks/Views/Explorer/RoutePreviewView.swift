import SwiftUI
import MapKit

struct RoutePreviewView: View {
    @ObservedObject var vm: ExplorerViewModel
    let route: GeneratedRoute
    @State private var showNavigation = false
    @State private var cameraPosition: MapCameraPosition = .automatic

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                // Map
                Map(position: $cameraPosition) {
                    ForEach(vm.mapAnnotations()) { annotation in
                        Annotation(annotation.title, coordinate: annotation.coordinate) {
                            StopMarker(order: annotation.order)
                        }
                    }
                }
                .frame(height: 280)

                VStack(alignment: .leading, spacing: 16) {
                    // Route header
                    VStack(alignment: .leading, spacing: 6) {
                        Text(route.title)
                            .font(.title2.bold())
                        Text(route.description)
                            .foregroundStyle(.secondary)
                            .font(.subheadline)

                        HStack(spacing: 16) {
                            Label("\(route.stops.count) stops", systemImage: "mappin.and.ellipse")
                            Label("\(route.totalDistance, specifier: "%.1f") km", systemImage: "arrow.triangle.swap")
                            Label("\(route.totalDuration) min", systemImage: "clock")
                        }
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    }

                    Divider()

                    // Stops list
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Stops")
                            .font(.headline)

                        ForEach(Array(route.stops.enumerated()), id: \.element.contentItem.id) { idx, stop in
                            StopRow(stop: stop, index: idx)
                        }
                    }

                    Divider()

                    // Contributors
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Contributors")
                            .font(.headline)
                        Text("Purchasing this route compensates these creators:")
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        ForEach(Array(route.contributions.sorted(by: { $0.value > $1.value })), id: \.key) { wallet, pct in
                            HStack {
                                Text(wallet.prefix(10) + "...")
                                    .font(.system(.caption, design: .monospaced))
                                Spacer()
                                Text("\(Int(pct * 100))%")
                                    .font(.caption.weight(.medium))
                            }
                        }
                    }
                }
                .padding()
            }
        }
        .navigationTitle("Your Walk")
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            VStack(spacing: 0) {
                Divider()
                HStack {
                    VStack(alignment: .leading) {
                        Text("Price")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(WalletService.weiToOG(route.priceOg))
                            .font(.title3.bold())
                    }
                    Spacer()
                    Button {
                        Task { await vm.prepareAndPurchase() }
                    } label: {
                        if vm.isPurchasing {
                            ProgressView()
                        } else {
                            Label("Purchase Route", systemImage: "cart")
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(vm.isPurchasing)
                }
                .padding()
                .background(.regularMaterial)
            }
        }
        .navigationDestination(isPresented: $showNavigation) {
            NavigationWalkView(vm: vm)
        }
        .onChange(of: vm.purchasedRoute) { _, purchased in
            if purchased != nil {
                showNavigation = true
            }
        }
        .alert("Error", isPresented: .constant(vm.errorMessage != nil)) {
            Button("OK") { vm.errorMessage = nil }
        } message: {
            Text(vm.errorMessage ?? "")
        }
    }
}

struct StopMarker: View {
    let order: Int

    var body: some View {
        ZStack {
            Circle()
                .fill(Color.accentColor)
                .frame(width: 30, height: 30)
            Text("\(order)")
                .font(.caption.bold())
                .foregroundStyle(.white)
        }
    }
}

struct StopRow: View {
    let stop: RouteStop
    let index: Int

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack {
                Circle()
                    .fill(Color.accentColor.opacity(0.15))
                    .frame(width: 36, height: 36)
                Text(stop.contentItem.category.icon)
                    .font(.system(size: 18))
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(stop.contentItem.title)
                    .font(.subheadline.weight(.medium))
                Text(stop.contentItem.description.prefix(80) + "…")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                if stop.walkTimeMins > 0 {
                    Label("\(stop.walkTimeMins) min walk", systemImage: "figure.walk")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .padding(.top, 2)
                }
            }
        }
    }
}
