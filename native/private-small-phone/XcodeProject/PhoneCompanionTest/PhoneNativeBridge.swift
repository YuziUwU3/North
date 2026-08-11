import AVFoundation
import Foundation
import Speech
import WebKit

@MainActor
final class PhoneNativeBridge: NSObject, WKScriptMessageHandler {
    static let handlerName = "smallPhoneNative"
    static let contractVersion = 4

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
        case "speech.pause":
            nativeSpeech.pause()
            reply(requestID: requestID, result: ["paused": true])
        case "speech.resume":
            do {
                try nativeSpeech.resume()
                reply(requestID: requestID, result: ["resumed": true])
            } catch {
                reply(requestID: requestID, error: "native_speech_resume_failed")
            }
        case "speech.rebuild":
            do {
                try nativeSpeech.rebuild()
                reply(requestID: requestID, result: ["rebuilt": true])
            } catch {
                reply(requestID: requestID, error: "native_speech_rebuild_failed")
            }
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
    private var audioEngine: AVAudioEngine?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var sessionID = ""
    private var eventHandler: (([String: Any]) -> Void)?
    private var startToken = UUID()
    private var tapInstalled = false
    private var partialCommitTask: Task<Void, Never>?
    private var restartTask: Task<Void, Never>?
    private var latestTranscript = ""
    private var language = "zh-CN"
    private var recognitionGeneration = UUID()
    private var isActive = false
    private var isPaused = false
    private var restartFailures = 0

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
        self.language = language
        eventHandler = onEvent
        isActive = true
        isPaused = false

        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            Task { @MainActor in
                guard let self, self.startToken == token else { return }
                guard status == .authorized else {
                    completion("speech_permission_denied")
                    self.stop(notify: false)
                    return
                }
                AVAudioApplication.requestRecordPermission { [weak self] allowed in
                    Task { @MainActor in
                        guard let self, self.startToken == token else { return }
                        guard allowed else {
                            completion("microphone_permission_denied")
                            self.stop(notify: false)
                            return
                        }
                        do {
                            try self.beginRecognition(language: language)
                            completion(nil)
                        } catch {
                            completion("native_speech_start_failed")
                            self.stop(notify: false)
                        }
                    }
                }
            }
        }
    }

    func stop(notify: Bool) {
        startToken = UUID()
        isActive = false
        isPaused = false
        recognitionGeneration = UUID()
        partialCommitTask?.cancel()
        partialCommitTask = nil
        restartTask?.cancel()
        restartTask = nil
        cleanupCurrentRecognition(deactivateAudioSession: true)
        if notify, !sessionID.isEmpty {
            emit(type: "end")
        }
        reset()
    }

    func pause() {
        guard isActive, !isPaused else { return }
        isPaused = true
        recognitionGeneration = UUID()
        partialCommitTask?.cancel()
        partialCommitTask = nil
        restartTask?.cancel()
        restartTask = nil
        latestTranscript = ""
        cleanupCurrentRecognition(deactivateAudioSession: true)
    }

    func resume() throws {
        guard isActive, isPaused, !sessionID.isEmpty else { return }
        isPaused = false
        do {
            try beginRecognition(language: language)
            restartFailures = 0
        } catch {
            isPaused = true
            throw error
        }
    }

    func rebuild() throws {
        guard isActive, !sessionID.isEmpty else { return }
        isPaused = true
        recognitionGeneration = UUID()
        partialCommitTask?.cancel()
        partialCommitTask = nil
        restartTask?.cancel()
        restartTask = nil
        latestTranscript = ""
        cleanupCurrentRecognition(deactivateAudioSession: true)
        isPaused = false
        do {
            try beginRecognition(language: language)
            restartFailures = 0
        } catch {
            isPaused = true
            throw error
        }
    }

    private func beginRecognition(language: String) throws {
        guard isActive, !isPaused, !sessionID.isEmpty else { return }
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

        let engine = AVAudioEngine()
        audioEngine = engine
        let input = engine.inputNode
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
        engine.prepare()
        try engine.start()

        let generation = UUID()
        recognitionGeneration = generation
        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            Task { @MainActor in
                guard let self,
                      self.isActive,
                      !self.sessionID.isEmpty,
                      self.recognitionGeneration == generation else { return }
                if let result {
                    self.restartFailures = 0
                    let transcript = result.bestTranscription.formattedString
                    self.latestTranscript = transcript
                    self.emit(
                        type: "result",
                        transcript: transcript,
                        isFinal: result.isFinal
                    )
                    if result.isFinal {
                        self.partialCommitTask?.cancel()
                        self.partialCommitTask = nil
                        self.rotateRecognition(afterNanoseconds: 220_000_000)
                    } else {
                        self.schedulePartialCommit(transcript)
                    }
                } else if error != nil {
                    self.rotateRecognition(afterNanoseconds: 420_000_000)
                }
            }
        }
    }

    private func schedulePartialCommit(_ transcript: String) {
        partialCommitTask?.cancel()
        guard !transcript.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            partialCommitTask = nil
            return
        }
        let session = sessionID
        partialCommitTask = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 1_150_000_000)
            guard !Task.isCancelled else { return }
            guard let self,
                  self.sessionID == session,
                  !self.latestTranscript.isEmpty else { return }
            self.emit(
                type: "result",
                transcript: self.latestTranscript,
                isFinal: true
            )
            self.rotateRecognition(afterNanoseconds: 220_000_000)
        }
    }

    private func rotateRecognition(afterNanoseconds delay: UInt64) {
        guard isActive, !isPaused, !sessionID.isEmpty else { return }
        recognitionGeneration = UUID()
        partialCommitTask?.cancel()
        partialCommitTask = nil
        restartTask?.cancel()
        restartTask = nil
        latestTranscript = ""
        cleanupCurrentRecognition(deactivateAudioSession: true)

        let session = sessionID
        restartTask = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: delay)
            guard !Task.isCancelled,
                  let self,
                  self.isActive,
                  !self.isPaused,
                  self.sessionID == session else { return }
            do {
                try self.beginRecognition(language: self.language)
                self.restartFailures = 0
            } catch {
                self.restartFailures += 1
                let retryDelay = UInt64(min(2_000, 300 + self.restartFailures * 250)) * 1_000_000
                self.rotateRecognition(afterNanoseconds: retryDelay)
            }
        }
    }

    private func cleanupCurrentRecognition(deactivateAudioSession: Bool) {
        if let engine = audioEngine {
            if engine.isRunning {
                engine.stop()
            }
            if tapInstalled {
                engine.inputNode.removeTap(onBus: 0)
                tapInstalled = false
            }
            engine.reset()
        }
        request?.endAudio()
        task?.cancel()
        request = nil
        task = nil
        audioEngine = nil
        if deactivateAudioSession {
            try? AVAudioSession.sharedInstance().setActive(
                false,
                options: .notifyOthersOnDeactivation
            )
        }
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
        partialCommitTask?.cancel()
        partialCommitTask = nil
        restartTask?.cancel()
        restartTask = nil
        request = nil
        task = nil
        sessionID = ""
        eventHandler = nil
        latestTranscript = ""
        language = "zh-CN"
        restartFailures = 0
        isPaused = false
    }

    private enum NativeSpeechError: Error {
        case unavailable
        case noAudioInput
    }
}
