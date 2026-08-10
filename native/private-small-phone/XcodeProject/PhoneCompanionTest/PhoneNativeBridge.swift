import AVFoundation
import Foundation
import Speech
import WebKit

@MainActor
final class PhoneNativeBridge: NSObject, WKScriptMessageHandler {
    static let handlerName = "smallPhoneNative"
    static let contractVersion = 3

    weak var webView: WKWebView?
    var openDeviceManagement: (() -> Void)?
    private let nativeSpeech = NativeSpeechRecognitionController()

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
        case "speech.start":
            let arguments = payload["payload"] as? [String: Any] ?? [:]
            performSpeechStart(requestID: requestID, arguments: arguments)
        case "speech.stop", "speech.abort":
            nativeSpeech.stop(notify: false)
            reply(requestID: requestID, result: ["stopped": true])
        case "storage.get", "storage.put", "storage.delete":
            let arguments = payload["payload"] as? [String: Any] ?? [:]
            performStorageAction(
                requestID: requestID,
                action: action,
                arguments: arguments
            )
        default:
            reply(requestID: requestID, error: "unsupported_action")
        }
    }

    private func performSpeechStart(
        requestID: String,
        arguments: [String: Any]
    ) {
        let sessionID = arguments["sessionId"] as? String ?? ""
        let language = arguments["lang"] as? String ?? "zh-CN"
        guard !sessionID.isEmpty, sessionID.count <= 100 else {
            reply(requestID: requestID, error: "invalid_speech_session")
            return
        }
        nativeSpeech.start(
            sessionID: sessionID,
            language: language,
            onEvent: { [weak self] event in
                self?.emitSpeechEvent(event)
            },
            completion: { [weak self] error in
                guard let self else { return }
                if let error {
                    self.reply(requestID: requestID, error: error)
                } else {
                    self.reply(
                        requestID: requestID,
                        result: ["started": true, "sessionId": sessionID]
                    )
                }
            }
        )
    }

    private func emitSpeechEvent(_ event: [String: Any]) {
        guard JSONSerialization.isValidJSONObject(event),
              let data = try? JSONSerialization.data(withJSONObject: event),
              let json = String(data: data, encoding: .utf8) else {
            return
        }
        webView?.evaluateJavaScript(
            "window.__smallPhoneNativeSpeechEvent && window.__smallPhoneNativeSpeechEvent(\(json));"
        )
    }

    private func performStorageAction(
        requestID: String,
        action: String,
        arguments: [String: Any]
    ) {
        guard let key = arguments["key"] as? String,
              let url = nativeStorageURL(for: key) else {
            reply(requestID: requestID, error: "invalid_storage_key")
            return
        }

        do {
            switch action {
            case "storage.get":
                guard FileManager.default.fileExists(atPath: url.path) else {
                    reply(
                        requestID: requestID,
                        result: ["found": false]
                    )
                    return
                }
                let data = try Data(contentsOf: url)
                let value = try JSONSerialization.jsonObject(with: data)
                reply(
                    requestID: requestID,
                    result: ["found": true, "value": value]
                )
            case "storage.put":
                guard let value = arguments["value"],
                      JSONSerialization.isValidJSONObject(value) else {
                    reply(requestID: requestID, error: "invalid_storage_value")
                    return
                }
                let data = try JSONSerialization.data(withJSONObject: value)
                try data.write(to: url, options: .atomic)
                reply(
                    requestID: requestID,
                    result: ["saved": true, "bytes": data.count]
                )
            case "storage.delete":
                if FileManager.default.fileExists(atPath: url.path) {
                    try FileManager.default.removeItem(at: url)
                }
                reply(requestID: requestID, result: ["deleted": true])
            default:
                reply(requestID: requestID, error: "unsupported_storage_action")
            }
        } catch {
            reply(requestID: requestID, error: "native_storage_failed")
        }
    }

    private func nativeStorageURL(for key: String) -> URL? {
        let allowed = CharacterSet.alphanumerics.union(
            CharacterSet(charactersIn: "._-")
        )
        guard !key.isEmpty,
              key.count <= 80,
              key.unicodeScalars.allSatisfy({ allowed.contains($0) }),
              let support = FileManager.default.urls(
                  for: .applicationSupportDirectory,
                  in: .userDomainMask
              ).first else {
            return nil
        }
        let directory = support.appendingPathComponent(
            "SmallPhonePrivateStore",
            isDirectory: true
        )
        do {
            try FileManager.default.createDirectory(
                at: directory,
                withIntermediateDirectories: true
            )
        } catch {
            return nil
        }
        return directory.appendingPathComponent(key + ".json")
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

@MainActor
private final class NativeSpeechRecognitionController {
    private let audioEngine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var sessionID = ""
    private var eventHandler: (([String: Any]) -> Void)?
    private var startToken = UUID()
    private var tapInstalled = false

    func start(
        sessionID: String,
        language: String,
        onEvent: @escaping ([String: Any]) -> Void,
        completion: @escaping (String?) -> Void
    ) {
        stop(notify: false)
        let token = UUID()
        startToken = token
        self.sessionID = sessionID
        eventHandler = onEvent

        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            Task { @MainActor in
                guard let self, self.startToken == token else { return }
                guard status == .authorized else {
                    completion("speech_permission_denied")
                    self.reset()
                    return
                }
                AVAudioApplication.requestRecordPermission { [weak self] allowed in
                    Task { @MainActor in
                        guard let self, self.startToken == token else { return }
                        guard allowed else {
                            completion("microphone_permission_denied")
                            self.reset()
                            return
                        }
                        do {
                            try self.beginRecognition(language: language)
                            completion(nil)
                        } catch {
                            completion("native_speech_start_failed")
                            self.reset()
                        }
                    }
                }
            }
        }
    }

    func stop(notify: Bool) {
        startToken = UUID()
        if audioEngine.isRunning {
            audioEngine.stop()
        }
        if tapInstalled {
            audioEngine.inputNode.removeTap(onBus: 0)
            tapInstalled = false
        }
        request?.endAudio()
        task?.cancel()
        if notify, !sessionID.isEmpty {
            emit(type: "end")
        }
        reset()
        try? AVAudioSession.sharedInstance().setActive(
            false,
            options: .notifyOthersOnDeactivation
        )
    }

    private func beginRecognition(language: String) throws {
        guard let recognizer = SFSpeechRecognizer(
            locale: Locale(identifier: language)
        ), recognizer.isAvailable else {
            throw NativeSpeechError.unavailable
        }

        let audioSession = AVAudioSession.sharedInstance()
        try audioSession.setCategory(
            .playAndRecord,
            mode: .voiceChat,
            options: [.defaultToSpeaker, .allowBluetooth]
        )
        try audioSession.setActive(true, options: .notifyOthersOnDeactivation)

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        self.request = request

        let input = audioEngine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard format.sampleRate > 0, format.channelCount > 0 else {
            throw NativeSpeechError.noAudioInput
        }
        input.installTap(
            onBus: 0,
            bufferSize: 1_024,
            format: format
        ) { buffer, _ in
            request.append(buffer)
        }
        tapInstalled = true
        audioEngine.prepare()
        try audioEngine.start()

        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            Task { @MainActor in
                guard let self, !self.sessionID.isEmpty else { return }
                if let result {
                    self.emit(
                        type: "result",
                        transcript: result.bestTranscription.formattedString,
                        isFinal: result.isFinal
                    )
                    if result.isFinal {
                        self.finishCurrentSession()
                    }
                } else if error != nil {
                    self.emit(type: "error", error: "recognition_failed")
                    self.finishCurrentSession()
                }
            }
        }
    }

    private func finishCurrentSession() {
        if audioEngine.isRunning {
            audioEngine.stop()
        }
        if tapInstalled {
            audioEngine.inputNode.removeTap(onBus: 0)
            tapInstalled = false
        }
        request?.endAudio()
        task?.cancel()
        emit(type: "end")
        reset()
    }

    private func emit(
        type: String,
        transcript: String = "",
        isFinal: Bool = false,
        error: String = ""
    ) {
        guard !sessionID.isEmpty else { return }
        var event: [String: Any] = [
            "sessionId": sessionID,
            "type": type
        ]
        if !transcript.isEmpty {
            event["transcript"] = transcript
            event["isFinal"] = isFinal
        }
        if !error.isEmpty {
            event["error"] = error
        }
        eventHandler?(event)
    }

    private func reset() {
        request = nil
        task = nil
        sessionID = ""
        eventHandler = nil
    }

    private enum NativeSpeechError: Error {
        case unavailable
        case noAudioInput
    }
}
