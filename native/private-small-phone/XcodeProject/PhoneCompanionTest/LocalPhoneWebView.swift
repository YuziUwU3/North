import SwiftUI
import UIKit
import WebKit

struct LocalPhoneWebView: UIViewRepresentable {
    let onOpenDeviceManagement: () -> Void

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
        configuration.userContentController.addUserScript(
            WKUserScript(
                source: Self.bridgeBootstrap,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
        )

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        context.coordinator.bridge.webView = webView
        context.coordinator.bridge.openDeviceManagement =
            onOpenDeviceManagement
        loadBundledPhone(in: webView)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.bridge.openDeviceManagement =
            onOpenDeviceManagement
    }

    static func dismantleUIView(
        _ webView: WKWebView,
        coordinator: Coordinator
    ) {
        webView.configuration.userContentController.removeScriptMessageHandler(
            forName: PhoneNativeBridge.handlerName
        )
        coordinator.bridge.webView = nil
        coordinator.bridge.openDeviceManagement = nil
        webView.navigationDelegate = nil
    }

    private func loadBundledPhone(in webView: WKWebView) {
        guard let bundleURL = Bundle.main.url(
            forResource: "PhoneWeb",
            withExtension: "bundle"
        ),
        let phoneBundle = Bundle(url: bundleURL),
        let fileURL = phoneBundle.url(
            forResource: "小手机",
            withExtension: "html"
        ) else {
            webView.loadHTMLString(
                "<meta charset='utf-8'><body style='background:#111;color:white;font-family:-apple-system;padding:24px'>安装包缺少小手机本地资源，请重新生成完整安装包。</body>",
                baseURL: nil
            )
            return
        }
        webView.loadFileURL(
            fileURL,
            allowingReadAccessTo: bundleURL
        )
    }

    private static let bridgeBootstrap = """
    (() => {
      let sequence = 0;
      const waiting = new Map();
      window.__smallPhoneNativeReply = payload => {
        const item = waiting.get(payload.requestId);
        if (!item) return;
        waiting.delete(payload.requestId);
        payload.error ? item.reject(new Error(payload.error)) : item.resolve(payload.result);
      };
      window.SmallPhoneNative = Object.freeze({
        request(action, payload = {}) {
          return new Promise((resolve, reject) => {
            const requestId = `native-${Date.now()}-${++sequence}`;
            waiting.set(requestId, { resolve, reject });
            window.webkit.messageHandlers.smallPhoneNative.postMessage({
              requestId, action, payload
            });
          });
        }
      });
    })();
    """
}
