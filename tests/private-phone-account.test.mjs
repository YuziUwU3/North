import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const bridge = fs.readFileSync(
  new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift', import.meta.url),
  'utf8'
);
const migration = fs.readFileSync(
  new URL('../supabase/migrations/202608110001_private_phone_accounts.sql', import.meta.url),
  'utf8'
);

test('phone account UI is private-app only and preserves local data before a choice', () => {
  assert.match(app, /window\.__SMALL_PHONE_PRIVATE__===true/);
  assert.match(app, /if\(!info\.found\)\{await privatePhoneCloudBackup\(true\)/);
  assert.match(app, /系统没有自动上传或下载/);
  assert.match(app, /当前本机不会在确认前发生任何变化/);
  assert.match(app, /S=mergeStateData\(d\);normalizeLoadedState\(\);phoneFriendState\(\)/);
});

test('private app stores auth tokens in Keychain and never returns them to JavaScript', () => {
  assert.match(bridge, /import Security/);
  assert.match(bridge, /kSecClassGenericPassword/);
  assert.match(bridge, /kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly/);
  assert.match(bridge, /privateAccountKeychainService/);
  assert.doesNotMatch(bridge, /"accessToken": session\.accessToken/);
  assert.doesNotMatch(bridge, /"refreshToken": session\.refreshToken/);
});

test('phone and password login, refresh, backup, and restore all use the native bridge', () => {
  for (const action of [
    'account.password.signin',
    'account.backup.info',
    'account.backup.upload',
    'account.backup.restore',
  ]) {
    assert.match(bridge, new RegExp(action.replaceAll('.', '\\.') ));
  }
  assert.match(bridge, /\/auth\/v1\/token\?grant_type=password/);
  assert.match(bridge, /smallphone\." \+ digits \+ "@example\.com/);
  assert.doesNotMatch(bridge, /\/auth\/v1\/otp/);
  assert.doesNotMatch(bridge, /account\.otp\.(?:send|verify)/);
  assert.match(app, /autocomplete="current-password"/);
  assert.match(app, /account\.password\.signin/);
  assert.doesNotMatch(app, /privatePhoneAccountSendOTP|privatePhoneAccountVerifyOTP/);
  assert.match(bridge, /\/auth\/v1\/token\?grant_type=refresh_token/);
  assert.match(bridge, /SHA256\.hash\(data: snapshotData\)/);
  assert.match(app, /privatePhoneCloudMarkDirty\(savedAt\)/);
  assert.match(app, /privatePhoneCloudAutoBackup/);
});

test('cloud backup table is auth-owned and rejects stale snapshot overwrite', () => {
  assert.match(migration, /alter table public\.private_phone_backups enable row level security/i);
  assert.match(migration, /auth\.uid\(\) = user_id/g);
  assert.match(migration, /to authenticated/);
  assert.match(migration, /where private_phone_backups\.captured_at <= excluded\.captured_at/i);
  assert.match(migration, /references auth\.users\(id\) on delete cascade/i);
  assert.doesNotMatch(migration, /^\s*phone(?:_number)?\s+/im);
});
