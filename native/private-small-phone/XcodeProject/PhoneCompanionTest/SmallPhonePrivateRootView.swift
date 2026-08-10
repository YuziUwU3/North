import SwiftUI

struct SmallPhonePrivateRootView: View {
    @State private var showsDeviceManagement = false

    var body: some View {
        LocalPhoneWebView {
            showsDeviceManagement = true
        }
        .ignoresSafeArea(.container, edges: .bottom)
        .fullScreenCover(isPresented: $showsDeviceManagement) {
            NavigationStack {
                CompanionRootView()
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("完成") {
                                showsDeviceManagement = false
                            }
                        }
                    }
            }
        }
    }
}
