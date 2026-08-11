import SwiftUI

struct SmallPhonePrivateRootView: View {
    @State private var showsDeviceManagement = false

    var body: some View {
        LocalPhoneWebView {
            showsDeviceManagement = true
        }
        .ignoresSafeArea(.container, edges: .bottom)
        // Keep the WKWebView frame fixed when the software keyboard appears.
        // Otherwise SwiftUI first shrinks the representable and WebKit then
        // scrolls the focused field, producing the visible down/up bounce.
        .ignoresSafeArea(.keyboard, edges: .bottom)
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
