import Foundation
import ReplayKit
import UIKit
import WebKit

@MainActor
final class ScreenShareCoordinator {
    static let shared = ScreenShareCoordinator()
    static let appGroup = "group.com.qianyi.PhoneCompanionTest"
    static let broadcastBundleID = "com.qianyi.PhoneCompanionTest.ScreenBroadcast"

    private weak var webView: WKWebView?
    private var timer: Timer?
    private var lastActive = false
    private var picker: RPSystemBroadcastPickerView?

    func attach(to webView: WKWebView?) {
        self.webView = webView
        guard webView != nil else {
            timer?.invalidate()
            timer = nil
            return
        }
        if timer == nil {
            timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
                Task { @MainActor in self?.poll() }
            }
        }
        poll(force: true)
    }

    func status() -> [String: Any] {
        let defaults = UserDefaults(suiteName: Self.appGroup)
        return [
            "active": defaults?.bool(forKey: "screenShare.active.v1") ?? false,
            "frameAt": defaults?.double(forKey: "screenShare.frameAt.v1") ?? 0
        ]
    }

    func presentSystemPicker() -> Bool {
        guard let webView else { return false }
        picker?.removeFromSuperview()
        let broadcastPicker = RPSystemBroadcastPickerView(frame: CGRect(x: 1, y: 1, width: 44, height: 44))
        broadcastPicker.preferredExtension = Self.broadcastBundleID
        broadcastPicker.showsMicrophoneButton = false
        broadcastPicker.alpha = 0.01
        webView.addSubview(broadcastPicker)
        picker = broadcastPicker
        let button = broadcastPicker.subviews.compactMap { $0 as? UIButton }.first
        button?.sendActions(for: .touchUpInside)
        return button != nil
    }

    func requestStop() {
        UserDefaults(suiteName: Self.appGroup)?.set(true, forKey: "screenShare.stopRequested.v1")
    }

    func latestFrameDataURL() -> String? {
        guard let base = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: Self.appGroup
        ) else { return nil }
        let url = base.appendingPathComponent("screen-share-latest.jpg")
        guard let data = try? Data(contentsOf: url), !data.isEmpty else { return nil }
        return "data:image/jpeg;base64," + data.base64EncodedString()
    }

    private func poll(force: Bool = false) {
        let active = UserDefaults(suiteName: Self.appGroup)?.bool(
            forKey: "screenShare.active.v1"
        ) ?? false
        guard force || active != lastActive else { return }
        lastActive = active
        guard let webView else { return }
        let activeLiteral = active ? "true" : "false"
        let script = "window.__smallPhoneScreenShareEvent && window.__smallPhoneScreenShareEvent({active:\(activeLiteral)});"
        webView.evaluateJavaScript(script, completionHandler: nil)
    }
}
