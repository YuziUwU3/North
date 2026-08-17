import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const app = read('app.js');
const html = read('小手机.html');
const sw = read('sw.js');
const account = read('ai-account.js');
const project = read('native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj');
const webView = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift');

test('v971 web source keeps private 1.0.93 compatibility', () => {
  assert.match(app, /APP_VER='v971 · 连续回复朋友圈与远控承接修复'/);
  assert.match(html, /__NORTH_SHELL_BUILD__='971'/);
  assert.match(sw, /const BUILD='971'/);
  assert.doesNotMatch(project, /CURRENT_PROJECT_VERSION = 40|MARKETING_VERSION = 1\.0\.40/);
  assert.equal((project.match(/CURRENT_PROJECT_VERSION = 93;/g) || []).length, 12);
  assert.equal((project.match(/MARKETING_VERSION = 1\.0\.93;/g) || []).length, 12);
  assert.match(webView, /__SMALL_PHONE_PRIVATE_BUILD__ = '1\.0\.93 \(93\)'/);
});

test('AI account first screen carries the approved visible red notice', () => {
  assert.match(account, /内置AI的新购买入口已经关闭/);
  assert.match(account, /color:#ff5b6f/);
});
