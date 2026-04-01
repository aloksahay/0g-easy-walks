import SwiftUI

struct MyRoutesView: View {
    @StateObject private var vm = ExplorerViewModel()

    var body: some View {
        NavigationStack {
            Group {
                if vm.purchasedRoutes.isEmpty {
                    ContentUnavailableView(
                        "No Routes Yet",
                        systemImage: "figure.walk",
                        description: Text("Purchase a walking tour to see it here")
                    )
                } else {
                    List(vm.purchasedRoutes) { route in
                        NavigationLink {
                            RouteDetailView(route: route)
                        } label: {
                            RouteRowView(route: route)
                        }
                    }
                }
            }
            .navigationTitle("My Routes")
            .task { await vm.loadPurchasedRoutes() }
        }
    }
}

struct RouteRowView: View {
    let route: Route

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(route.title)
                .font(.headline)
            Text(route.description)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(2)
            HStack(spacing: 12) {
                Label(route.city, systemImage: "mappin.circle")
                if let dur = route.duration_mins {
                    Label("\(dur) min", systemImage: "clock")
                }
                if let dist = route.distance_km {
                    Label("\(dist, specifier: "%.1f") km", systemImage: "arrow.triangle.swap")
                }
            }
            .font(.caption2)
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }
}

struct RouteDetailView: View {
    let route: Route

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(route.description)
                    .padding()

                if let stops = route.stops, !stops.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Stops")
                            .font(.headline)
                            .padding(.horizontal)

                        ForEach(Array(stops.enumerated()), id: \.element.id) { idx, item in
                            HStack {
                                Text("\(idx + 1)")
                                    .font(.caption.bold())
                                    .frame(width: 24, height: 24)
                                    .background(Color.accentColor)
                                    .foregroundStyle(.white)
                                    .clipShape(Circle())
                                VStack(alignment: .leading) {
                                    Text(item.title).font(.subheadline.weight(.medium))
                                    Text(item.category.displayName).font(.caption).foregroundStyle(.secondary)
                                }
                            }
                            .padding(.horizontal)
                        }
                    }
                }
            }
        }
        .navigationTitle(route.title)
        .navigationBarTitleDisplayMode(.inline)
    }
}
