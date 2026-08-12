import AlarmKit
import CryptoKit
import Foundation
import SwiftUI

struct SmallPhoneAlarmMetadata: AlarmMetadata {
    let webAlarmID: String
    let roleID: String
}

@available(iOS 26.0, *)
@MainActor
final class NativeAlarmService {
    static let shared = NativeAlarmService()

    private struct StoredAlarm: Codable {
        let nativeID: UUID
        let signature: String
        let expectedFireAt: Date
        let repeatsDaily: Bool
    }

    private struct RequestedAlarm {
        let webID: String
        let roleID: String
        let roleName: String
        let label: String
        let hour: Int
        let minute: Int
        let repeatsDaily: Bool

        var signature: String {
            [roleID, roleName, label, String(hour), String(minute), repeatsDaily ? "daily" : "once"]
                .joined(separator: "|")
        }
    }

    private let manager = AlarmManager.shared
    private let storeKey = "small-phone.native-alarm-records.v1"

    private init() {}

    func synchronize(_ payload: [[String: Any]]) async throws -> [String: Any] {
        let requested = payload.compactMap(parseRequestedAlarm)
        var stored = loadRecords()
        let current = try manager.alarms
        var liveIDs = Set(current.map(\.id))
        var cancelled = 0
        var scheduled = 0
        var firedIDs: [String] = []

        let requestedIDs = Set(requested.map(\.webID))
        for (webID, record) in Array(stored) where !requestedIDs.contains(webID) {
            if liveIDs.contains(record.nativeID) {
                try manager.cancel(id: record.nativeID)
                liveIDs.remove(record.nativeID)
                cancelled += 1
            }
            stored.removeValue(forKey: webID)
        }

        if requested.isEmpty {
            saveRecords(stored)
            return result(
                authorized: manager.authorizationState == .authorized,
                scheduled: scheduled,
                cancelled: cancelled,
                firedIDs: firedIDs
            )
        }

        var authorization = manager.authorizationState
        if authorization == .notDetermined {
            authorization = try await manager.requestAuthorization()
        }
        guard authorization == .authorized else {
            saveRecords(stored)
            return result(
                authorized: false,
                scheduled: 0,
                cancelled: cancelled,
                firedIDs: firedIDs
            )
        }

        let now = Date()
        for item in requested {
            let nativeID = deterministicID(for: item.webID)
            let signature = digest(item.signature)
            let expectedFireAt = nextFireDate(hour: item.hour, minute: item.minute, after: now)

            if let old = stored[item.webID],
               !old.repeatsDaily,
               old.expectedFireAt <= now,
               !liveIDs.contains(old.nativeID),
               old.signature == signature {
                firedIDs.append(item.webID)
                stored.removeValue(forKey: item.webID)
                continue
            }

            if let old = stored[item.webID],
               old.signature == signature,
               liveIDs.contains(old.nativeID) {
                continue
            }

            if liveIDs.contains(nativeID) {
                try manager.cancel(id: nativeID)
                liveIDs.remove(nativeID)
                cancelled += 1
            }

            let time = Alarm.Schedule.Relative.Time(hour: item.hour, minute: item.minute)
            let recurrence: Alarm.Schedule.Relative.Recurrence = item.repeatsDaily
                ? .weekly([.monday, .tuesday, .wednesday, .thursday, .friday, .saturday, .sunday])
                : .never
            let schedule = Alarm.Schedule.relative(.init(time: time, repeats: recurrence))
            let title = [item.roleName, item.label].filter { !$0.isEmpty }.joined(separator: " · ")
            let titleResource = LocalizedStringResource(
                "small_phone_alarm_dynamic_title",
                defaultValue: String.LocalizationValue(stringLiteral: title.isEmpty ? "小手机闹钟" : title)
            )
            let alert = AlarmPresentation.Alert(
                title: titleResource,
                secondaryButton: AlarmButton(
                    text: "打开小手机",
                    textColor: .pink,
                    systemImageName: "iphone"
                ),
                secondaryButtonBehavior: .custom
            )
            let attributes = AlarmAttributes(
                presentation: AlarmPresentation(alert: alert),
                metadata: SmallPhoneAlarmMetadata(webAlarmID: item.webID, roleID: item.roleID),
                tintColor: Color.pink
            )
            let configuration = AlarmManager.AlarmConfiguration<SmallPhoneAlarmMetadata>.alarm(
                schedule: schedule,
                attributes: attributes
            )
            _ = try await manager.schedule(id: nativeID, configuration: configuration)
            liveIDs.insert(nativeID)
            stored[item.webID] = StoredAlarm(
                nativeID: nativeID,
                signature: signature,
                expectedFireAt: expectedFireAt,
                repeatsDaily: item.repeatsDaily
            )
            scheduled += 1
        }

        saveRecords(stored)
        return result(
            authorized: true,
            scheduled: scheduled,
            cancelled: cancelled,
            firedIDs: firedIDs
        )
    }

    private func parseRequestedAlarm(_ raw: [String: Any]) -> RequestedAlarm? {
        guard (raw["enabled"] as? Bool) != false,
              let webID = raw["id"] as? String,
              !webID.isEmpty,
              let time = raw["time"] as? String else { return nil }
        let pieces = time.split(separator: ":")
        guard pieces.count == 2,
              let hour = Int(pieces[0]),
              let minute = Int(pieces[1]),
              (0...23).contains(hour),
              (0...59).contains(minute) else { return nil }
        return RequestedAlarm(
            webID: webID,
            roleID: raw["contactId"] as? String ?? "",
            roleName: raw["roleName"] as? String ?? "",
            label: raw["label"] as? String ?? "闹钟",
            hour: hour,
            minute: minute,
            repeatsDaily: (raw["repeat"] as? String) == "daily"
        )
    }

    private func nextFireDate(hour: Int, minute: Int, after date: Date) -> Date {
        var components = DateComponents()
        components.hour = hour
        components.minute = minute
        return Calendar.autoupdatingCurrent.nextDate(
            after: date,
            matching: components,
            matchingPolicy: .nextTime,
            repeatedTimePolicy: .first,
            direction: .forward
        ) ?? date.addingTimeInterval(24 * 60 * 60)
    }

    private func deterministicID(for webID: String) -> UUID {
        let bytes = Array(SHA256.hash(data: Data("small-phone-alarm:\(webID)".utf8)).prefix(16))
        let hex = bytes.map { String(format: "%02x", $0) }.joined()
        let value = "\(hex.prefix(8))-\(hex.dropFirst(8).prefix(4))-\(hex.dropFirst(12).prefix(4))-\(hex.dropFirst(16).prefix(4))-\(hex.dropFirst(20).prefix(12))"
        return UUID(uuidString: value) ?? UUID()
    }

    private func digest(_ value: String) -> String {
        SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    private func loadRecords() -> [String: StoredAlarm] {
        guard let data = UserDefaults.standard.data(forKey: storeKey) else { return [:] }
        return (try? JSONDecoder().decode([String: StoredAlarm].self, from: data)) ?? [:]
    }

    private func saveRecords(_ records: [String: StoredAlarm]) {
        guard let data = try? JSONEncoder().encode(records) else { return }
        UserDefaults.standard.set(data, forKey: storeKey)
    }

    private func result(
        authorized: Bool,
        scheduled: Int,
        cancelled: Int,
        firedIDs: [String]
    ) -> [String: Any] {
        [
            "supported": true,
            "authorized": authorized,
            "scheduled": scheduled,
            "cancelled": cancelled,
            "firedIds": firedIDs
        ]
    }
}
