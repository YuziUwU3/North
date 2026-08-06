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
  '../PhoneCompanion/CompanionSync_v816后台通知与即时唤醒',
);
const nativeApp = fs.readFileSync(path.join(nativeDir, 'PhoneCompanionTestApp.swift'), 'utf8');
const nativeSync = fs.readFileSync(path.join(nativeDir, 'CompanionSyncView.swift'), 'utf8');

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
  assert.match(edge, /apns-push-type/);
  assert.doesNotMatch(edge, /BEGIN PRIVATE KEY-----\s+[A-Za-z0-9+/]{40}/);
});

test('native app registers APNs and immediately syncs on a background wake', () => {
  assert.match(nativeApp, /registerForRemoteNotifications/);
  assert.match(nativeApp, /didReceiveRemoteNotification/);
  assert.match(nativeApp, /setBackgroundWakeHandler/);
  assert.match(nativeApp, /backgroundWakeHandler/);
  assert.match(nativeApp, /pendingWakeCount/);
  assert.match(nativeSync, /phone_companion_register_push_token/);
  assert.match(nativeSync, /pushCoordinator\.setBackgroundWakeHandler/);
  assert.match(nativeSync, /setBackgroundWakeHandler/);
  assert.match(nativeSync, /let didSynchronize = await service\.synchronize/);
  assert.match(nativeSync, /didSynchronize \? \.newData : \.failed/);
  assert.match(nativeApp, /finishBackgroundWake\(finalResult\)/);
  assert.doesNotMatch(nativeSync, /onChange\(of: pushCoordinator\.wakeSequence\)/);
  assert.match(nativeSync, /for _ in 0\.\.<80 where syncInFlight/);
});
