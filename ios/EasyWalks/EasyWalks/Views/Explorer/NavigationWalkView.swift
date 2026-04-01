import SwiftUI
import MapKit

struct NavigationWalkView: View {
    @ObservedObject var vm: ExplorerViewModel
    @State private var cameraPosition: MapCameraPosition = .automatic

    var body: some View {
        VStack(spacing: 0) {
            // Map
            Map(position: $cameraPosition) {
                ForEach(vm.mapAnnotations()) { annotation in
                    Annotation(annotation.title, coordinate: annotation.coordinate) {
                        StopMarker(order: annotation.order)
                    }
                }
                if let stop = vm.currentStop {
                    UserAnnotation()
                    MapCircle(center: CLLocationCoordinate2D(
                        latitude: stop.contentItem.latitude,
                        longitude: stop.contentItem.longitude
                    ), radius: 50)
                    .foregroundStyle(.blue.opacity(0.2))
                }
            }
            .frame(maxHeight: 300)

            // Stop content
            if let stop = vm.currentStop {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        // Progress
                        HStack {
                            Text("Stop \(stop.order) of \(vm.generatedRoute?.stops.count ?? 0)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Spacer()
                            Text(stop.contentItem.category.displayName)
                                .font(.caption.weight(.medium))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(Color.accentColor.opacity(0.15))
                                .foregroundStyle(Color.accentColor)
                                .clipShape(Capsule())
                        }

                        Text(stop.contentItem.title)
                            .font(.title3.bold())

                        Text(stop.contentItem.description)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)

                        // Tags
                        if !stop.contentItem.tags.isEmpty {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack {
                                    ForEach(stop.contentItem.tags, id: \.self) { tag in
                                        Text("#\(tag)")
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                            }
                        }
                    }
                    .padding()
                }
            }

            Spacer()

            // Navigation controls
            HStack(spacing: 16) {
                Button {
                    vm.previousStop()
                    updateCamera()
                } label: {
                    Label("Previous", systemImage: "chevron.left")
                }
                .buttonStyle(.bordered)
                .disabled(vm.currentStopIndex == 0)

                Spacer()

                Button {
                    vm.nextStop()
                    updateCamera()
                } label: {
                    Label("Next Stop", systemImage: "chevron.right")
                        .labelStyle(.titleAndIcon)
                }
                .buttonStyle(.borderedProminent)
                .disabled(vm.currentStopIndex == (vm.generatedRoute?.stops.count ?? 1) - 1)
            }
            .padding()
        }
        .navigationTitle("Navigating")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { updateCamera() }
    }

    private func updateCamera() {
        guard let stop = vm.currentStop else { return }
        cameraPosition = .region(MKCoordinateRegion(
            center: CLLocationCoordinate2D(
                latitude: stop.contentItem.latitude,
                longitude: stop.contentItem.longitude
            ),
            span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)
        ))
    }
}
