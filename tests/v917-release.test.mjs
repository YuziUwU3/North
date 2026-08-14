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

test('v925 source and private 1.0.51 versions are aligned', () => {
  assert.match(app, /APP_VER='v925 · 共同生活入口与无操作跳页修复'/);
  assert.match(html, /__NORTH_SHELL_BUILD__='925'/);
  assert.match(sw, /const BUILD='925'/);
  assert.doesNotMatch(project, /CURRENT_PROJECT_VERSION = 40|MARKETING_VERSION = 1\.0\.40/);
  assert.equal((project.match(/CURRENT_PROJECT_VERSION = 51;/g) || []).length, 12);
  assert.equal((project.match(/MARKETING_VERSION = 1\.0\.51;/g) || []).length, 12);
  assert.match(webView, /__SMALL_PHONE_PRIVATE_BUILD__ = '1\.0\.51 \(51\)'/);
});

test('AI account first screen carries the approved visible red notice', () => {
  assert.match(account, /内置配置仅为方便新手使用，会收取人工服务费；自己注册并使用外置配置通常更省钱。两种方式可自行选择，不强制。/);
  assert.match(account, /color:#ff5b6f/);
});
