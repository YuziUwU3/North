import Foundation
import WebKit

@MainActor
final class PhoneNativeBridge: NSObject, WKScriptMessageHandler {
    static let handlerName = "smallPhoneNative"
    static let contractVersion = 1

    weak var webView: WKWebView?

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == Self.handlerName,
              let payload = message.body as? [String: Any],
              let requestID = payload["requestId"] as? String,
              let action = payload["action"] as? String else {
            return
        }

        switch action {
        case "bridge.info":
            reply(
                requestID: requestID,
                result: [
                    "contractVersion": Self.contractVersion,
                    "appKind": "private-small-phone",
                    "isBundledApp": true
                ]
            )
        default:
            reply(
                requestID: requestID,
                error: "unsupported_action"
            )
        }
    }

    func announceReady() {
        let script = """
        window.dispatchEvent(new CustomEvent('small-phone-native-ready', {
          detail: { contractVersion: \(Self.contractVersion), appKind: 'private-small-phone' }
        }));
        """
        webView?.evaluateJavaScript(script)
    }

    private func reply(
        requestID: String,
        result: [String: Any]? = nil,
        error: String? = nil
    ) {
        var payload: [String: Any] = ["requestId": requestID]
        if let result {
            payload["result"] = result
        }
        if let error {
            payload["error"] = error
        }
        guard JSONSerialization.isValidJSONObject(payload),
              let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else {
            return
        }
        webView?.evaluateJavaScript(
            "window.__smallPhoneNativeReply && window.__smallPhoneNativeReply(\(json));"
        )
    }
}
