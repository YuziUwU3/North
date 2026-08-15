import DeviceActivity
import SwiftUI

struct SmallPhonePrivateRootView: View {
    @State private var showsDeviceManagement = false
    @State private var reportFilterEnd = Date()

    private let reportContext =
        DeviceActivityReport.Context("Total Activity")

    private var todayFilter: DeviceActivityFilter {
        let calendar = Calendar.current
        let start = calendar.startOfDay(for: Date())
        let end = min(
            calendar.date(byAdding: .day, value: 1, to: start) ?? Date(),
            max(start.addingTimeInterval(1), reportFilterEnd)
        )
        return DeviceActivityFilter(
            segment: .daily(during: DateInterval(start: start, end: end)),
            users: .all,
            devices: .init([.iPhone])
        )
    }

    var body: some View {
        ZStack {
            // Keep the system-owned top safe area pure black.  The web view still
            // starts below the status bar, so time, signal and battery remain
            // fully tappable and no page is pushed under the Dynamic Island.
            Color.black
                .ignoresSafeArea(.container, edges: .top)

            // Keep the privacy-preserving report extension mounted so an
            // explicit role read can request a fresh tokenized snapshot even
            // while the all-in-one web surface is the visible page.
            DeviceActivityReport(reportContext, filter: todayFilter)
                .frame(width: 2, height: 2)
                .opacity(0.01)
                .allowsHitTesting(false)

            LocalPhoneWebView {
                showsDeviceManagement = true
            }
        }
        .ignoresSafeArea(.container, edges: .bottom)
        // Keep the WKWebView frame fixed when the software keyboard appears.
        // Otherwise SwiftUI first shrinks the representable and WebKit then
        // scrolls the focused field, producing the visible down/up bounce.
        .ignoresSafeArea(.keyboard, edges: .bottom)
        .onReceive(
            NotificationCenter.default.publisher(
                for: .companionUsageReportRefreshRequested
            )
        ) { _ in
            reportFilterEnd = Date()
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
