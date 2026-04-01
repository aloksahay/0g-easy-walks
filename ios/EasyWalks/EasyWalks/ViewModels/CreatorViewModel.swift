import Foundation
import SwiftUI
import PhotosUI
import CoreLocation

@MainActor
class CreatorViewModel: ObservableObject {
    @Published var myContent: [ContentItem] = []
    @Published var isLoading = false
    @Published var isUploading = false
    @Published var errorMessage: String?
    @Published var successMessage: String?
    @Published var earnings: String = "0"

    // Upload form state
    @Published var uploadTitle = ""
    @Published var uploadDescription = ""
    @Published var uploadCategory: ContentCategory = .place
    @Published var uploadCity = ""
    @Published var uploadTagInput = ""
    @Published var uploadTags: [String] = []
    @Published var uploadLocation: CLLocationCoordinate2D?
    @Published var selectedPhotos: [PhotosPickerItem] = []
    @Published var selectedPhotoData: [(data: Data, mimeType: String)] = []

    func loadMyContent() async {
        guard let wallet = WalletService.shared.walletAddress else { return }
        isLoading = true
        defer { isLoading = false }

        do {
            let response = try await APIClient.shared.getCreatorContent(wallet: wallet)
            myContent = response.items
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loadEarnings() async {
        guard let wallet = WalletService.shared.walletAddress else { return }
        do {
            let response = try await APIClient.shared.getEarnings(wallet: wallet)
            earnings = WalletService.weiToOG(response.unclaimed)
        } catch {
            // Earnings fetch is non-critical
        }
    }

    func addTag() {
        let tag = uploadTagInput.trimmingCharacters(in: .whitespaces).lowercased()
        guard !tag.isEmpty, !uploadTags.contains(tag) else { return }
        uploadTags.append(tag)
        uploadTagInput = ""
    }

    func loadSelectedPhotos() async {
        var result: [(data: Data, mimeType: String)] = []
        for item in selectedPhotos {
            if let data = try? await item.loadTransferable(type: Data.self) {
                let mimeType = data.starts(with: [0x89, 0x50]) ? "image/png" : "image/jpeg"
                result.append((data: data, mimeType: mimeType))
            }
        }
        selectedPhotoData = result
    }

    func uploadContent() async {
        guard !uploadTitle.isEmpty,
              !uploadDescription.isEmpty,
              !uploadCity.isEmpty,
              let location = uploadLocation else {
            errorMessage = "Please fill in all fields and set a location"
            return
        }

        isUploading = true
        errorMessage = nil
        successMessage = nil
        defer { isUploading = false }

        do {
            let item = try await APIClient.shared.uploadContent(
                title: uploadTitle,
                description: uploadDescription,
                category: uploadCategory,
                latitude: location.latitude,
                longitude: location.longitude,
                city: uploadCity,
                tags: uploadTags,
                photoData: selectedPhotoData
            )
            myContent.insert(item, at: 0)
            successMessage = "'\(item.title)' uploaded successfully!"
            resetForm()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func resetForm() {
        uploadTitle = ""
        uploadDescription = ""
        uploadCategory = .place
        uploadCity = ""
        uploadTags = []
        uploadTagInput = ""
        uploadLocation = nil
        selectedPhotos = []
        selectedPhotoData = []
    }
}
