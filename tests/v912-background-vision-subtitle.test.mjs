import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../小手机.html', import.meta.url), 'utf8');
const bridge = fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift', import.meta.url), 'utf8');
const pip = fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/CallPictureInPictureController.swift', import.meta.url), 'utf8');
const alarm = fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/NativeAlarmService.swift', import.meta.url), 'utf8');
const delegate = fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneCompanionTestApp.swift', import.meta.url), 'utf8');
const project = fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj', import.meta.url), 'utf8');

test('v913 release versions align', () => {
  assert.match(app, /APP_VER='v913 · 通话框字幕与轻透布局'/);
  assert.match(html, /__NORTH_SHELL_BUILD__='913'/);
  assert.match(project, /CURRENT_PROJECT_VERSION = 37;/);
  assert.match(project, /MARKETING_VERSION = 1\.0\.37;/);
  assert.match(bridge, /contractVersion = 16/);
});

test('shared-screen vision owns a finite native background task', () => {
  assert.match(bridge, /beginVisionBackgroundTask\(token: token\)/);
  assert.match(bridge, /UIApplication\.shared\.beginBackgroundTask/);
  assert.match(bridge, /case "screenShare\.vision\.complete"/);
  assert.match(bridge, /UIApplication\.shared\.endBackgroundTask\(taskID\)/);
  assert.match(app, /screenShare\.vision\.complete/);
  assert.match(app, /if\(frameToken\)await reply/);
  assert.match(app, /finally\{callNativeScreenVisionComplete\(frameToken\)/);
});

test('main call subtitles replay the original animation on every update', () => {
  assert.match(html, /\.csline\{[^}]*animation:csin \.3s ease/);
  assert.match(html, /@keyframes csin\{from\{opacity:0;transform:translateY\(8px\)\}to\{opacity:1;transform:translateY\(0\)\}\}/);
  assert.match(app, /duration:300,easing:'cubic-bezier\(\.25,\.1,\.25,1\)'/);
});

test('native floating subtitles mirror the original timing and movement', () => {
  assert.match(pip, /duration: 0\.3/);
  assert.match(pip, /controlPoint1: CGPoint\(x: 0\.25, y: 0\.1\)/);
  assert.match(pip, /controlPoint2: CGPoint\(x: 0\.25, y: 1\)/);
  assert.match(pip, /subtitleLabel\.alpha = 0/);
  assert.match(pip, /translationX: 0,[\s\S]*y: 8/);
});

test('alarm notes become role messages in background and chat history', () => {
  assert.match(app, /alarmPrepareCompanionText/);
  assert.match(app, /companionText:String\(a\.companionText/);
  assert.match(app, /alarmApplyFiredEvents\(result&&result\.firedEvents\)/);
  assert.match(app, /_alarm:true/);
  assert.match(alarm, /UNCalendarNotificationTrigger/);
  assert.match(alarm, /"smallPhoneAlarm": alarmInfo/);
  assert.match(alarm, /deliveredRoleEvents\(\)/);
  assert.match(delegate, /recordInteractedRoleAlarm/);
});
