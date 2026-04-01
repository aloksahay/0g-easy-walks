import SwiftUI

struct MainTabView: View {
    var body: some View {
        TabView {
            ExplorerFlowView()
                .tabItem {
                    Label("Explore", systemImage: "map")
                }

            MyRoutesView()
                .tabItem {
                    Label("My Routes", systemImage: "figure.walk")
                }

            CreatorFlowView()
                .tabItem {
                    Label("Create", systemImage: "plus.circle")
                }
        }
    }
}
