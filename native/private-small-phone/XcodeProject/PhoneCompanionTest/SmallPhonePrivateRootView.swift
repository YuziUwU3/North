import SwiftUI

struct SmallPhonePrivateRootView: View {
    @State private var showsDeviceManagement = false

    var body: some View {
        ZStack(alignment: .topTrailing) {
            LocalPhoneWebView {
                showsDeviceManagement = true
            }
            .ignoresSafeArea()

            Button {
                showsDeviceManagement = true
            } label: {
                Image(systemName: "iphone.and.arrow.forward")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 34, height: 34)
                    .background(.black.opacity(0.56), in: Circle())
            }
            .padding(.top, 8)
            .padding(.trailing, 10)
            .accessibilityLabel("真实 iPhone 管理")
        }
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
