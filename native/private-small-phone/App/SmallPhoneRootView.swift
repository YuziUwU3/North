import SwiftUI

struct SmallPhoneRootView: View {
    var body: some View {
        LocalPhoneWebView()
            .ignoresSafeArea(.container, edges: .bottom)
    }
}
