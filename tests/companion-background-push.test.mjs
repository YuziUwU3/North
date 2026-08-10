import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/202608060002_phone_companion_apns.sql'),
  'utf8',
);
const edge = fs.readFileSync(
  path.join(root, 'supabase/functions/phone-companion-push/index.ts'),
  'utf8',
);
const nativeDir = path.resolve(
  root,
  'native/phone-companion-v857/Xcode主App文件',
);
const nativeApp = fs.readFileSync(path.join(nativeDir, 'PhoneCompanionTestApp.swift'), 'utf8');
const nativeSync = fs.readFileSync(path.join(nativeDir, 'CompanionSyncView.swift'), 'utf8');
const atomicMigration = fs.readFileSync(
  path.join(root, 'supabase/migrations/202608100001_phone_companion_atomic_snapshot.sql'),
  'utf8',
);

test('APNs token registration stays device-secret protected', () => {
  assert.match(migration, /phone_companion_device_ok\(v_target, p_device_secret\)/);
  assert.match(migration, /invalid-apns-device-token/);
  assert.match(migration, /length\(v_token\) > 256/);
  assert.match(migration, /v_token !~ '\^\[0-9a-f\]\+\$'/);
  assert.doesNotMatch(migration, /\{32,256\}/);
  assert.match(migration, /grant execute[\s\S]*phone_companion_register_push_token[\s\S]*anon, authenticated/);
  assert.match(migration, /phone_companion_get_push_context[\s\S]*to service_role/);
});

test('edge wake validates the queued command and keeps APNs credentials in secrets', () => {
  assert.match(edge, /phone_companion_get_push_context/);
  assert.match(edge, /APNS_PRIVATE_KEY/);
  assert.match(edge, /content-available/);
  assert.match(edge, /"apns-push-type": "background"/);
  assert.match(edge, /"apns-priority": "5"/);
  assert.match(edge, /"apns-collapse-id": "phone-companion-commands"/);
  assert.doesNotMatch(edge, /alert:|sound:|badge:/);
  assert.doesNotMatch(edge, /BEGIN PRIVATE KEY-----\s+[A-Za-z0-9+/]{40}/);
});

test('native app registers APNs and uses a command-first background wake', () => {
  assert.match(nativeApp, /registerForRemoteNotifications/);
  assert.match(nativeApp, /didReceiveRemoteNotification/);
  assert.match(nativeApp, /setBackgroundWakeHandler/);
  assert.match(nativeApp, /backgroundWakeHandler/);
  assert.match(nativeApp, /pendingWakeCount/);
  assert.match(nativeSync, /phone_companion_register_push_token/);
  assert.match(nativeSync, /pushCoordinator\.setBackgroundWakeHandler/);
  assert.match(nativeSync, /setBackgroundWakeHandler/);
  assert.match(nativeSync, /let didSynchronize = await service\.synchronizeCommandsOnly/);
  assert.match(nativeSync, /didSynchronize \? \.newData : \.failed/);
  assert.match(nativeApp, /finishBackgroundWake\(finalResult\)/);
  assert.doesNotMatch(nativeSync, /onChange\(of: pushCoordinator\.wakeSequence\)/);
  assert.match(nativeSync, /processPendingCommandsSerialized/);
  assert.doesNotMatch(nativeSync, /waitForExisting/);
  assert.match(nativeSync, /上一轮命令仍在执行，请稍后重试/);
  assert.match(nativeSync, /resolvePlaceNames: false/);
  assert.match(nativeSync, /controlOnly: true/);
  assert.match(nativeApp, /Silent background pushes do not require alert authorization/);
  assert.match(nativeApp, /willPresent[\s\S]*?\{\s*\[\]\s*\}/);
  assert.doesNotMatch(nativeSync.slice(
    nativeSync.indexOf('pushCoordinator.setBackgroundWakeHandler'),
    nativeSync.indexOf('locationManager.resumeTrackingIfAuthorized'),
  ), /wellnessService\.refresh|service\.synchronize\(/);
});

test('full sync processes commands before refreshing heavyweight usage data', () => {
  const fullSync = nativeSync.slice(
    nativeSync.indexOf('fileprivate func synchronize('),
    nativeSync.indexOf('fileprivate func synchronizeCommandsOnly('),
  );
  assert.ok(fullSync.indexOf('processPendingCommandsSerialized(') >= 0);
  assert.ok(fullSync.indexOf('fetchTodayDirectUsageWithTimeout()') >= 0);
  assert.ok(
    fullSync.indexOf('processPendingCommandsSerialized(') <
      fullSync.indexOf('fetchTodayDirectUsageWithTimeout()'),
  );
});

test('successful commands are verified and atomically completed with a monotonic snapshot', () => {
  assert.match(nativeSync, /effectiveLockedTokens\(\)\.contains\(token\)/);
  assert.match(nativeSync, /persistentLockStore\.shield\.applications/);
  assert.match(nativeSync, /snapshotSequenceKey/);
  assert.match(nativeSync, /"snapshotSequence": nextSnapshotSequence\(\)/);
  assert.match(nativeSync, /try await applyRemoteCommand/);
  assert.match(nativeSync, /本地屏蔽配置写入失败，未发送成功回执/);
  assert.match(nativeSync, /phone_companion_complete_command/);
  assert.match(atomicMigration, /phone_companion_snapshot_sequence/);
  assert.match(atomicMigration, /create or replace function public\.phone_companion_complete_command/);
  assert.match(atomicMigration, /for update/);
  assert.match(atomicMigration, /status = 'completed'/);
  assert.match(atomicMigration, /snapshot = p_snapshot/);
  assert.match(atomicMigration, /raise exception 'stale-snapshot'/);
  assert.match(atomicMigration, /v_sequence is null[\s\S]*snapshotSequence/);
});
