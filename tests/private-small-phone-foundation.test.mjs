import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('private app charter fixes the product name and freezes public North', () => {
  const charter = read('docs/maintenance/私人小手机App_唯一总纲.md');
  assert.match(charter, /私人版固定叫 \*\*小手机\*\*/);
  assert.match(charter, /当前审核中的版本保持不动/);
  assert.match(charter, /绝不能同时控制同一台真实 iPhone/);
  assert.match(charter, /命令已发送.*设备已收到.*设备已执行/s);
  assert.match(charter, /采集时间、上传时间/);
});

test('private app loads bundled phone resources instead of a remote shell', () => {
  const webView = read(
    'native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift'
  );
  assert.match(webView, /Bundle\.main\.url/);
  assert.match(webView, /appendingPathComponent\("index\.html"/);
  assert.match(webView, /let readAccessURL = fileURL[\s\S]*deletingLastPathComponent/);
  assert.match(webView, /allowingReadAccessTo: readAccessURL/);
  assert.match(webView, /didFailProvisionalNavigation/);
  assert.match(webView, /url\.scheme == "about"/);
  assert.match(webView, /loadFileURL/);
  assert.match(webView, /window\.__SMALL_PHONE_PRIVATE__ = true/);
  assert.match(webView, /window\.__smallPhoneNativeInsets/);
  assert.match(webView, /webView\.window\?\.safeAreaInsets/);
  assert.match(webView, /north-native-app/);
  assert.match(webView, /root\.classList\.add\('north-native-app'\)/);
  assert.match(webView, /__SMALL_PHONE_PRIVATE_BUILD__ = '1\.0\.4 \(4\)'/);
  assert.doesNotMatch(webView, /https?:\/\//);
});

test('private app has a versioned native bridge and shared-resource staging', () => {
  const bridge = read(
    'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift'
  );
  const manifest = JSON.parse(read(
    'native/private-small-phone/Resources/private-phone-web.manifest.json'
  ));
  const staging = read(
    'native/private-small-phone/scripts/stage-private-phone-web.mjs'
  );
  assert.match(bridge, /contractVersion = 2/);
  assert.match(bridge, /case "license\.request"/);
  assert.match(bridge, /case "storage\.get", "storage\.put", "storage\.delete"/);
  assert.match(bridge, /SmallPhonePrivateStore/);
  assert.match(bridge, /data\.write\(to: url, options: \.atomic\)/);
  assert.match(bridge, /URLSession\.shared\.data/);
  assert.match(bridge, /lkhlyfpssmrjkkzhuzag\.supabase\.co/);
  assert.equal(manifest.entry, '小手机.html');
  assert.ok(manifest.files.includes('app.js'));
  assert.match(staging, /repoRoot/);
  assert.match(staging, /path\.join\(outputRoot, 'index\.html'\)/);
  assert.doesNotMatch(staging, /writeFile/);
  const app = read('app.js');
  assert.match(app, /SmallPhoneNative\.request\('storage\.put'/);
  assert.match(app, /SmallPhoneNative\.request\('storage\.get'/);
  assert.match(app, /v==null\?imgGetIDB\(k\):v/,'an existing web archive remains readable before native migration');
});

test('bundled license requests use the restricted native network bridge', () => {
  const source = read('license-gate.js');
  assert.match(source, /window\.SmallPhoneNative && location\.protocol === 'file:'/);
  assert.match(source, /SmallPhoneNative\.request\('license\.request'/);
  assert.match(source, /else \{\s*response = await fetch/);
  assert.match(read('app.js'), /__SMALL_PHONE_PRIVATE__\?'小手机':'North'/);
});

test('controller lease contract permits exactly one named controller', () => {
  const schema = JSON.parse(read(
    'native/private-small-phone/Contracts/controller-lease.schema.json'
  ));
  assert.deepEqual(
    schema.properties.controllerKind.enum,
    ['public-north', 'private-small-phone']
  );
  assert.ok(schema.required.includes('controllerInstanceId'));
  assert.ok(schema.required.includes('leaseVersion'));
  assert.equal(schema.additionalProperties, false);
});

test('real Mac project keeps all Screen Time targets and becomes 小手机', () => {
  const project = read(
    'native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj'
  );
  for (const target of [
    'PhoneCompanionTest',
    'PhoneCompanionReport',
    'PhoneCompanionMonitor',
    'PhoneCompanionShield',
    'RoleNotificationService'
  ]) {
    assert.match(project, new RegExp(`name = ${target};`));
  }
  assert.match(project, /INFOPLIST_KEY_CFBundleDisplayName = "小手机";/);
  assert.match(project, /PRODUCT_BUNDLE_IDENTIFIER = com\.qianyi\.PhoneCompanionTest;/);
  assert.match(project, /CURRENT_PROJECT_VERSION = 4;/);
  assert.match(project, /MARKETING_VERSION = 1\.0\.4;/);

  const scheme = read(
    'native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/xcshareddata/xcschemes/PhoneCompanionTest.xcscheme'
  );
  assert.match(scheme, /BlueprintIdentifier = "E74615C33022636200B3739D"/);
  assert.match(scheme, /BuildableName = "PhoneCompanionTest\.app"/);
  assert.match(scheme, /<LaunchAction/);
});

test('private project removes the live map before background and has a real timeout race', () => {
  const content = read(
    'native/private-small-phone/XcodeProject/PhoneCompanionTest/ContentView.swift'
  );
  const sync = read(
    'native/private-small-phone/XcodeProject/PhoneCompanionTest/CompanionSyncView.swift'
  );
  assert.match(content, /if scenePhase == \.active,[\s\S]*let location/);
  assert.match(sync, /AsyncStream<UsageReadOutcome>\.makeStream/);
  assert.doesNotMatch(sync, /withTaskGroup\([\s\S]{0,300}UsageReadOutcome/);
  assert.match(sync, /guard !Task\.isCancelled else \{ return nil \}/);
});
