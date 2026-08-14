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

test('v932 source and private 1.0.56 versions are aligned', () => {
  assert.match(app, /APP_VER='v932 · 苹果主屏系统条与图标恢复'/);
  assert.match(html, /__NORTH_SHELL_BUILD__='932'/);
  assert.match(sw, /const BUILD='932'/);
  assert.doesNotMatch(project, /CURRENT_PROJECT_VERSION = 40|MARKETING_VERSION = 1\.0\.40/);
  assert.equal((project.match(/CURRENT_PROJECT_VERSION = 56;/g) || []).length, 12);
  assert.equal((project.match(/MARKETING_VERSION = 1\.0\.56;/g) || []).length, 12);
  assert.match(webView, /__SMALL_PHONE_PRIVATE_BUILD__ = '1\.0\.56 \(56\)'/);
});

test('AI account first screen carries the approved visible red notice', () => {
  assert.match(account, /内置配置仅为方便新手使用，会收取人工服务费；自己注册并使用外置配置通常更省钱。两种方式可自行选择，不强制。/);
  assert.match(account, /color:#ff5b6f/);
});
