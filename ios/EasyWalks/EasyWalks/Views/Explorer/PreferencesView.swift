import SwiftUI

struct PreferencesView: View {
    @ObservedObject var vm: ExplorerViewModel
    let onGenerate: () -> Void

    var body: some View {
        Form {
            Section("City") {
                TextField("e.g. Tokyo, Paris, New York", text: $vm.preferences.city)
                    .autocorrectionDisabled()
            }

            Section("Duration") {
                Picker("Duration", selection: $vm.preferences.duration) {
                    ForEach(WalkPreferences.Duration.allCases, id: \.self) { d in
                        Text(d.displayName).tag(d)
                    }
                }
                .pickerStyle(.segmented)
            }

            Section("Include") {
                ForEach(ContentCategory.allCases, id: \.self) { cat in
                    Toggle(cat.displayName, isOn: Binding(
                        get: { vm.preferences.categories.contains(cat) },
                        set: { included in
                            if included {
                                vm.preferences.categories.insert(cat)
                            } else {
                                vm.preferences.categories.remove(cat)
                            }
                        }
                    ))
                }
            }

            Section("Interests") {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 100))], spacing: 8) {
                    ForEach(popularInterests, id: \.self) { interest in
                        InterestChip(
                            label: interest,
                            isSelected: vm.preferences.interests.contains(interest),
                            onTap: {
                                if vm.preferences.interests.contains(interest) {
                                    vm.preferences.interests.remove(interest)
                                } else {
                                    vm.preferences.interests.insert(interest)
                                }
                            }
                        )
                    }
                }
                .padding(.vertical, 4)
            }

            if let error = vm.errorMessage {
                Section {
                    Text(error)
                        .foregroundStyle(.red)
                        .font(.caption)
                }
            }
        }
        .safeAreaInset(edge: .bottom) {
            Button(action: onGenerate) {
                if vm.isGenerating {
                    HStack {
                        ProgressView()
                        Text("Curating your walk…")
                    }
                    .frame(maxWidth: .infinity)
                } else {
                    Label("Generate Route", systemImage: "sparkles")
                        .frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(vm.isGenerating || vm.preferences.city.isEmpty)
            .padding()
            .background(.regularMaterial)
        }
    }
}

struct InterestChip: View {
    let label: String
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            Text(label)
                .font(.caption.weight(.medium))
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(isSelected ? Color.accentColor : Color(.secondarySystemBackground))
                .foregroundStyle(isSelected ? .white : .primary)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}
