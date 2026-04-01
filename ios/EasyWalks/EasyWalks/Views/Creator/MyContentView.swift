import SwiftUI

struct MyContentView: View {
    @ObservedObject var vm: CreatorViewModel
    @State private var showUpload = false

    var body: some View {
        Group {
            if vm.isLoading {
                ProgressView("Loading…")
            } else if vm.myContent.isEmpty {
                ContentUnavailableView(
                    "No Content Yet",
                    systemImage: "photo.badge.plus",
                    description: Text("Upload places, eateries, or activities to contribute to walking tours")
                )
            } else {
                List(vm.myContent) { item in
                    ContentItemRow(item: item)
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showUpload = true
                } label: {
                    Image(systemName: "plus")
                }
            }
            ToolbarItem(placement: .topBarLeading) {
                HStack {
                    Image(systemName: "bitcoinsign.circle")
                    Text(vm.earnings)
                        .font(.subheadline.weight(.medium))
                }
                .foregroundStyle(Color.accentColor)
            }
        }
        .sheet(isPresented: $showUpload) {
            UploadContentView(vm: vm, isPresented: $showUpload)
        }
    }
}

struct ContentItemRow: View {
    let item: ContentItem

    var body: some View {
        HStack(spacing: 12) {
            // Category icon
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.accentColor.opacity(0.1))
                    .frame(width: 44, height: 44)
                Text(item.category.icon)
                    .font(.system(size: 22))
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(item.title)
                    .font(.subheadline.weight(.medium))
                Text(item.category.displayName + " · " + item.city)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if !item.tags.isEmpty {
                    Text(item.tags.prefix(3).map { "#\($0)" }.joined(separator: " "))
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
        }
        .padding(.vertical, 2)
    }
}
