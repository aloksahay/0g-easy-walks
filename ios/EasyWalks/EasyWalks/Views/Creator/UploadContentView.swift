import SwiftUI
import PhotosUI
import MapKit

struct UploadContentView: View {
    @ObservedObject var vm: CreatorViewModel
    @Binding var isPresented: Bool
    @State private var showLocationPicker = false
    @State private var selectedCoordinate: CLLocationCoordinate2D?
    @State private var mapRegion = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 35.6762, longitude: 139.6503),
        span: MKCoordinateSpan(latitudeDelta: 0.1, longitudeDelta: 0.1)
    )

    var body: some View {
        NavigationStack {
            Form {
                Section("Details") {
                    TextField("Title", text: $vm.uploadTitle)
                    Picker("Category", selection: $vm.uploadCategory) {
                        ForEach(ContentCategory.allCases, id: \.self) { cat in
                            Label(cat.displayName, systemImage: categoryIcon(cat))
                                .tag(cat)
                        }
                    }
                    TextField("City", text: $vm.uploadCity)
                        .autocorrectionDisabled()
                }

                Section("Description") {
                    TextEditor(text: $vm.uploadDescription)
                        .frame(minHeight: 80)
                }

                Section("Location") {
                    if let loc = vm.uploadLocation {
                        HStack {
                            Image(systemName: "mappin.circle.fill")
                                .foregroundStyle(Color.accentColor)
                            Text("\(loc.latitude, specifier: "%.4f"), \(loc.longitude, specifier: "%.4f")")
                                .font(.system(.caption, design: .monospaced))
                            Spacer()
                            Button("Change") { showLocationPicker = true }
                                .font(.caption)
                        }
                    } else {
                        Button {
                            showLocationPicker = true
                        } label: {
                            Label("Pick Location on Map", systemImage: "mappin.and.ellipse")
                        }
                    }
                }

                Section("Tags") {
                    HStack {
                        TextField("Add tag…", text: $vm.uploadTagInput)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                        Button("Add") { vm.addTag() }
                            .disabled(vm.uploadTagInput.isEmpty)
                    }
                    if !vm.uploadTags.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack {
                                ForEach(vm.uploadTags, id: \.self) { tag in
                                    HStack(spacing: 4) {
                                        Text("#\(tag)")
                                            .font(.caption)
                                        Button {
                                            vm.uploadTags.removeAll { $0 == tag }
                                        } label: {
                                            Image(systemName: "xmark.circle.fill")
                                                .font(.caption)
                                        }
                                    }
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(Color.accentColor.opacity(0.1))
                                    .clipShape(Capsule())
                                }
                            }
                        }
                    }
                }

                Section("Photos (up to 5)") {
                    PhotosPicker(selection: $vm.selectedPhotos, maxSelectionCount: 5, matching: .images) {
                        Label("Select Photos", systemImage: "photo.stack")
                    }
                    .onChange(of: vm.selectedPhotos) { _, _ in
                        Task { await vm.loadSelectedPhotos() }
                    }

                    if !vm.selectedPhotoData.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack {
                                ForEach(0..<vm.selectedPhotoData.count, id: \.self) { idx in
                                    if let uiImage = UIImage(data: vm.selectedPhotoData[idx].data) {
                                        Image(uiImage: uiImage)
                                            .resizable()
                                            .scaledToFill()
                                            .frame(width: 80, height: 80)
                                            .clipped()
                                            .cornerRadius(8)
                                    }
                                }
                            }
                        }
                    }
                }

                if let error = vm.errorMessage {
                    Section {
                        Text(error).foregroundStyle(.red).font(.caption)
                    }
                }

                if let success = vm.successMessage {
                    Section {
                        Text(success).foregroundStyle(.green).font(.caption)
                    }
                }
            }
            .navigationTitle("Upload Content")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { isPresented = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Upload") {
                        Task {
                            await vm.uploadContent()
                            if vm.successMessage != nil {
                                try? await Task.sleep(nanoseconds: 1_000_000_000)
                                isPresented = false
                            }
                        }
                    }
                    .disabled(vm.isUploading || vm.uploadTitle.isEmpty || vm.uploadLocation == nil)
                    .overlay {
                        if vm.isUploading {
                            ProgressView().scaleEffect(0.8)
                        }
                    }
                }
            }
            .sheet(isPresented: $showLocationPicker) {
                LocationPickerView(selectedCoordinate: $vm.uploadLocation)
            }
        }
    }

    private func categoryIcon(_ cat: ContentCategory) -> String {
        switch cat {
        case .place: return "building.columns"
        case .activity: return "figure.hiking"
        case .eatery: return "fork.knife"
        }
    }
}
