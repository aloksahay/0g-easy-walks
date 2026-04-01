import SwiftUI
import MapKit

struct LocationPickerView: View {
    @Binding var selectedCoordinate: CLLocationCoordinate2D?
    @Environment(\.dismiss) private var dismiss
    @State private var cameraPosition: MapCameraPosition = .region(
        MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 35.6762, longitude: 139.6503),
            span: MKCoordinateSpan(latitudeDelta: 0.1, longitudeDelta: 0.1)
        )
    )
    @State private var pinnedCoordinate: CLLocationCoordinate2D?

    var body: some View {
        NavigationStack {
            ZStack {
                MapReader { proxy in
                    Map(position: $cameraPosition) {
                        if let coord = pinnedCoordinate {
                            Annotation("Selected", coordinate: coord) {
                                Image(systemName: "mappin.circle.fill")
                                    .font(.title)
                                    .foregroundStyle(Color.accentColor)
                            }
                        }
                    }
                    .onTapGesture { location in
                        if let coord = proxy.convert(location, from: .local) {
                            pinnedCoordinate = coord
                        }
                    }
                }

                // Center crosshair hint
                VStack {
                    Spacer()
                    Text("Tap anywhere on the map to pin the location")
                        .font(.caption)
                        .padding(8)
                        .background(.regularMaterial)
                        .cornerRadius(8)
                        .padding(.bottom, 80)
                }
            }
            .navigationTitle("Pick Location")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Confirm") {
                        selectedCoordinate = pinnedCoordinate
                        dismiss()
                    }
                    .disabled(pinnedCoordinate == nil)
                }
            }
        }
    }
}
