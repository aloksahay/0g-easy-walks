import SwiftUI

struct CreatorFlowView: View {
    @StateObject private var vm = CreatorViewModel()

    var body: some View {
        NavigationStack {
            MyContentView(vm: vm)
                .navigationTitle("My Content")
        }
        .task {
            await vm.loadMyContent()
            await vm.loadEarnings()
        }
    }
}
