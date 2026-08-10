import SwiftUI
import UIKit
import WebKit

struct LocalPhoneWebView: UIViewRepresentable {
    let onOpenDeviceManagement: () -> Void

    final class Coordinator: NSObject, WKNavigationDelegate {
        let bridge = PhoneNativeBridge()
        private var showingLoadFailure = false

        func webView(
            _ webView: WKWebView,
            didFinish navigation: WKNavigation!
        ) {
            if !showingLoadFailure {
                bridge.announceReady()
            }
        }

        func webView(
            _ webView: WKWebView,
            didFail navigation: WKNavigation!,
            withError error: Error
        ) {
            showLoadFailure(in: webView, error: error)
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: Error
        ) {
            showLoadFailure(in: webView, error: error)
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
            if url.isFileURL || url.scheme == "about" {
                decisionHandler(.allow)
            } else {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
            }
        }

        private func showLoadFailure(
            in webView: WKWebView,
            error: Error
        ) {
            guard !showingLoadFailure else { return }
            showingLoadFailure = true
            print("[SmallPhoneWeb] load failed: \(error.localizedDescription)")
            webView.loadHTMLString(
                LocalPhoneWebView.loadFailureHTML,
                baseURL: nil
            )
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
        ) else {
            webView.loadHTMLString(
                Self.missingResourceHTML,
                baseURL: nil
            )
            return
        }

        let fileURL = bundleURL
            .appendingPathComponent("index.html", isDirectory: false)
            .standardizedFileURL
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            webView.loadHTMLString(
                Self.missingResourceHTML,
                baseURL: nil
            )
            return
        }

        // WebKit requires the main file URL to be lexically inside the exact
        // directory granted here. Deriving both from one URL avoids the
        // "outside the sandbox" rejection seen on the real iPhone.
        let readAccessURL = fileURL
            .deletingLastPathComponent()
            .standardizedFileURL
        webView.loadFileURL(
            fileURL,
            allowingReadAccessTo: readAccessURL
        )
    }

    private static let missingResourceHTML = """
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <body style="margin:0;background:#111;color:white;font-family:-apple-system;padding:28px">
      <h2>小手机资源没有安装完整</h2>
      <p>请使用重新生成的完整安装包。</p>
    </body>
    """

    fileprivate static let loadFailureHTML = """
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <body style="margin:0;background:#111;color:white;font-family:-apple-system;padding:28px">
      <h2>小手机本地页面没有加载成功</h2>
      <p>原始数据没有被删除。请保留此页面并把 Xcode 日志发给开发者。</p>
    </body>
    """

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
