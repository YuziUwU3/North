import SwiftUI
import UIKit
import WebKit

struct LocalPhoneWebView: UIViewRepresentable {
    final class Coordinator: NSObject, WKNavigationDelegate {
        let bridge = PhoneNativeBridge()

        func webView(
            _ webView: WKWebView,
            didFinish navigation: WKNavigation!
        ) {
            bridge.announceReady()
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }
            if url.isFileURL {
                decisionHandler(.allow)
            } else {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
            }
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.userContentController.add(
            context.coordinator.bridge,
            name: PhoneNativeBridge.handlerName
        )

        let webView = WKWebView(
            frame: .zero,
            configuration: configuration
        )
        webView.navigationDelegate = context.coordinator
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        context.coordinator.bridge.webView = webView
        loadBundledPhone(in: webView)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    static func dismantleUIView(
        _ webView: WKWebView,
        coordinator: Coordinator
    ) {
        webView.configuration.userContentController.removeScriptMessageHandler(
            forName: PhoneNativeBridge.handlerName
        )
        coordinator.bridge.webView = nil
        webView.navigationDelegate = nil
    }

    private func loadBundledPhone(in webView: WKWebView) {
        guard let fileURL = Bundle.main.url(
            forResource: "小手机",
            withExtension: "html",
            subdirectory: "PhoneWeb"
        ) else {
            webView.loadHTMLString(
                "<meta charset='utf-8'><body style='background:#111;color:white;font-family:-apple-system;padding:24px'>安装包缺少小手机本地资源。</body>",
                baseURL: nil
            )
            return
        }
        webView.loadFileURL(
            fileURL,
            allowingReadAccessTo: fileURL.deletingLastPathComponent()
        )
    }
}
