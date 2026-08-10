import Foundation
import WebKit

@MainActor
final class PhoneNativeBridge: NSObject, WKScriptMessageHandler {
    static let handlerName = "smallPhoneNative"
    static let contractVersion = 1

    weak var webView: WKWebView?
    var openDeviceManagement: (() -> Void)?

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
        case "native.management.open":
            openDeviceManagement?()
            reply(requestID: requestID, result: ["opened": true])
        case "license.request":
            let arguments = payload["payload"] as? [String: Any] ?? [:]
            performLicenseRequest(requestID: requestID, arguments: arguments)
        default:
            reply(requestID: requestID, error: "unsupported_action")
        }
    }

    private func performLicenseRequest(
        requestID: String,
        arguments: [String: Any]
    ) {
        let baseURL = (arguments["baseUrl"] as? String ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let apiKey = arguments["apiKey"] as? String ?? ""
        let action = arguments["action"] as? String ?? ""
        let body = arguments["body"] as? [String: Any] ?? [:]
        let timeoutMS = arguments["timeoutMs"] as? Double ?? 25_000

        guard var components = URLComponents(string: baseURL),
              components.scheme == "https",
              components.host == "lkhlyfpssmrjkkzhuzag.supabase.co",
              !apiKey.isEmpty,
              !action.isEmpty else {
            reply(requestID: requestID, error: "invalid_license_request")
            return
        }
        components.path = "/functions/v1/phone-license"
        components.query = nil
        components.fragment = nil
        guard let url = components.url else {
            reply(requestID: requestID, error: "invalid_license_url")
            return
        }

        var requestBody = body
        requestBody["action"] = action
        guard JSONSerialization.isValidJSONObject(requestBody),
              let data = try? JSONSerialization.data(withJSONObject: requestBody) else {
            reply(requestID: requestID, error: "invalid_license_body")
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.httpBody = data
        request.timeoutInterval = min(60, max(5, timeoutMS / 1_000))
        request.setValue(apiKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        Task { [weak self] in
            guard let self else { return }
            do {
                let (data, response) = try await URLSession.shared.data(for: request)
                guard let http = response as? HTTPURLResponse,
                      let object = try? JSONSerialization.jsonObject(with: data),
                      let responseBody = object as? [String: Any] else {
                    self.reply(requestID: requestID, error: "invalid_license_response")
                    return
                }
                self.reply(
                    requestID: requestID,
                    result: ["status": http.statusCode, "payload": responseBody]
                )
            } catch {
                self.reply(requestID: requestID, error: "license_network_unavailable")
            }
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
