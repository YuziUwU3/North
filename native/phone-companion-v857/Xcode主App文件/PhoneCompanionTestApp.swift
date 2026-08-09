import Combine
import SwiftUI
import UIKit
import UserNotifications

@main
struct PhoneCompanionTestApp: App {
    @UIApplicationDelegateAdaptor(CompanionPushAppDelegate.self)
    private var pushDelegate

    var body: some Scene {
        WindowGroup {
            CompanionRootView()
        }
    }
}

@MainActor
final class CompanionPushCoordinator: ObservableObject {
    static let shared = CompanionPushCoordinator()

    typealias BackgroundWakeHandler =
        @MainActor () async -> UIBackgroundFetchResult

    static let tokenDefaultsKey = "companion.push.token.v1"
    static let environmentDefaultsKey = "companion.push.environment.v1"

    @Published private(set) var deviceToken =
        UserDefaults.standard.string(forKey: tokenDefaultsKey) ?? ""
    @Published private(set) var statusText = "尚未开启后台通知"
    @Published private(set) var wakeSequence = 0

    private var backgroundCompletions:
        [(UIBackgroundFetchResult) -> Void] = []
    private var backgroundWakeHandler: BackgroundWakeHandler?
    private var wakeTask: Task<Void, Never>?
    private var wakeTimeoutTask: Task<Void, Never>?
    private var pendingWakeCount = 0

    var environment: String {
        #if DEBUG
        return "sandbox"
        #else
        return "production"
        #endif
    }

    func refreshAuthorizationStatus() async {
        let settings = await UNUserNotificationCenter.current()
            .notificationSettings()
        switch settings.authorizationStatus {
        case .authorized, .provisional, .ephemeral:
            statusText = deviceToken.isEmpty
                ? "通知已允许，正在登记设备"
                : "后台通知已开启"
            UIApplication.shared.registerForRemoteNotifications()
        case .denied:
            statusText = "通知已关闭，请在系统设置中允许"
        case .notDetermined:
            statusText = "尚未开启后台通知"
        @unknown default:
            statusText = "通知状态未知"
        }
    }

    func requestAuthorization() async {
        do {
            let granted = try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .badge, .sound])
            guard granted else {
                statusText = "没有允许通知"
                return
            }
            statusText = "通知已允许，正在登记设备"
            UIApplication.shared.registerForRemoteNotifications()
        } catch {
            statusText = "开启通知失败：\(error.localizedDescription)"
        }
    }

    func updateDeviceToken(_ data: Data) {
        let token = data.map { String(format: "%02x", $0) }.joined()
        guard !token.isEmpty else { return }
        deviceToken = token
        statusText = "后台通知已开启"
        UserDefaults.standard.set(token, forKey: Self.tokenDefaultsKey)
        UserDefaults.standard.set(
            environment,
            forKey: Self.environmentDefaultsKey
        )
    }

    func registrationFailed(_ error: Error) {
        statusText = "设备登记失败：\(error.localizedDescription)"
    }

    func setBackgroundWakeHandler(
        _ handler: @escaping BackgroundWakeHandler
    ) {
        backgroundWakeHandler = handler
    }

    func receiveBackgroundWake(
        completion: @escaping (UIBackgroundFetchResult) -> Void
    ) {
        backgroundCompletions.append(completion)
        pendingWakeCount += 1
        wakeSequence += 1

        guard wakeTask == nil else { return }

        wakeTimeoutTask?.cancel()
        wakeTimeoutTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 25_000_000_000)
            guard let self, !Task.isCancelled else { return }
            self.wakeTask?.cancel()
            self.wakeTask = nil
            self.pendingWakeCount = 0
            self.finishBackgroundWake(.noData)
        }

        wakeTask = Task { [weak self] in
            guard let self else { return }
            var finalResult: UIBackgroundFetchResult = .noData

            // A silent push can arrive before SwiftUI finishes constructing
            // the sync view. Give the view a short window to register the
            // direct handler instead of acknowledging and losing the wake.
            for _ in 0..<30 where self.backgroundWakeHandler == nil {
                do {
                    try await Task.sleep(nanoseconds: 100_000_000)
                } catch {
                    return
                }
            }

            while self.pendingWakeCount > 0, !Task.isCancelled {
                self.pendingWakeCount = 0
                if let handler = self.backgroundWakeHandler {
                    let result = await handler()
                    switch result {
                    case .newData:
                        finalResult = .newData
                    case .failed:
                        switch finalResult {
                        case .newData:
                            break
                        default:
                            finalResult = .failed
                        }
                    case .noData:
                        break
                    @unknown default:
                        break
                    }
                }
            }

            guard !Task.isCancelled else { return }
            self.wakeTimeoutTask?.cancel()
            self.wakeTimeoutTask = nil
            self.wakeTask = nil
            self.finishBackgroundWake(finalResult)
        }
    }

    func finishBackgroundWake(_ result: UIBackgroundFetchResult) {
        let callbacks = backgroundCompletions
        backgroundCompletions.removeAll()
        callbacks.forEach { $0(result) }
    }
}

final class CompanionPushAppDelegate: NSObject,
    UIApplicationDelegate,
    UNUserNotificationCenterDelegate {

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions:
            [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        Task { @MainActor in
            await CompanionPushCoordinator.shared
                .refreshAuthorizationStatus()
        }
        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        Task { @MainActor in
            CompanionPushCoordinator.shared.updateDeviceToken(deviceToken)
        }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        Task { @MainActor in
            CompanionPushCoordinator.shared.registrationFailed(error)
        }
    }

    func application(
        _ application: UIApplication,
        didReceiveRemoteNotification userInfo: [AnyHashable: Any],
        fetchCompletionHandler completionHandler:
            @escaping (UIBackgroundFetchResult) -> Void
    ) {
        Task { @MainActor in
            CompanionPushCoordinator.shared.receiveBackgroundWake(
                completion: completionHandler
            )
        }
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .badge, .list]
    }
}
