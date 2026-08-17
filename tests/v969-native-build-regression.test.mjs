import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const app = read('app.js');
const shell = read('sw.js');
const bundleInfo = read('native/private-small-phone/Resources/PhoneWebBundleInfo.plist');
const localWebView = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift');
const project = read('native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj');
const pip = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/CallPictureInPictureController.swift');
const reportApp = read('native/private-small-phone/XcodeProject/PhoneCompanionReport/PhoneCompanionReport.swift');
const reportScene = read('native/private-small-phone/XcodeProject/PhoneCompanionReport/TotalActivityReport.swift');

test('v975 uses one web and private iOS build identity', () => {
  assert.match(app, /APP_VER='v975 · 独立授权与旧云锁移除'/);
  assert.match(app, /sw\.js\?v=975&r=v975-license-isolation-1/);
  assert.match(shell, /north-shell-v975/);
  assert.match(bundleInfo, /<string>975<\/string>/);
  assert.match(localWebView, /1\.0\.97 \(97\)/);
  assert.equal((project.match(/CURRENT_PROJECT_VERSION = 97;/g) || []).length, 12);
  assert.equal((project.match(/MARKETING_VERSION = 1\.0\.97;/g) || []).length, 12);
});

test('native shared-media gain uses only public AVFoundation types', () => {
  assert.match(pip, /^@preconcurrency import AVFoundation/m);
  assert.match(pip, /AVAudioUnitEQ\(numberOfBands: 0\)/);
  assert.match(pip, /gainUnit\.globalGain = min\(12, 5 \+ extraGain\)/);
  assert.match(pip, /Timer\.scheduledTimer\(/);
  assert.match(pip, /#selector\(enhancedAudioDidFinish\)/);
  assert.match(pip, /@objc private func enhancedAudioDidFinish\(\)/);
  assert.doesNotMatch(pip, /AVAudioUnitDynamicsProcessor/);
  assert.doesNotMatch(pip, /completionCallbackType/);
  assert.doesNotMatch(pip, /scheduleFile\([^\n]+\)\s*\{/);
});

test('Device Activity report imports bridge SDK concurrency annotations', () => {
  assert.match(reportApp, /^@preconcurrency import DeviceActivity/m);
  assert.match(reportScene, /^@preconcurrency import DeviceActivity/m);
});
