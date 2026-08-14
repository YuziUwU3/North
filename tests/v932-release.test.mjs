import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');
const app=read('../app.js');
const html=read('../小手机.html');
const sw=read('../sw.js');
const index=read('../index.html');
const repair=read('../repair.html');
const privateBundle=read('../native/private-small-phone/Resources/PhoneWebBundleInfo.plist');
const xcode=read('../native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj');
const webView=read('../native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift');

test('v932 web files use one cache-busting build number',()=>{
  assert.match(app,/APP_VER='v932 · 苹果主屏系统条与图标恢复'/);
  assert.match(app,/const url='sw\.js\?v=932'/);
  assert.match(html,/__NORTH_SHELL_BUILD__='932'/);
  assert.match(html,/app\.js\?v=932/);
  assert.match(sw,/const BUILD='932'/);
  assert.match(sw,/north-shell-v932/);
  assert.match(index,/小手机\.html\?v=932/);
  assert.match(repair,/小手机\.html\?v=932/);
});

test('the private iOS package is aligned with the shared v932 core',()=>{
  assert.match(privateBundle,/<string>932<\/string>/);
  assert.equal((xcode.match(/MARKETING_VERSION = 1\.0\.56;/g)||[]).length,12);
  assert.equal((xcode.match(/CURRENT_PROJECT_VERSION = 56;/g)||[]).length,12);
  assert.match(webView,/__SMALL_PHONE_PRIVATE_BUILD__ = '1\.0\.56 \(56\)'/);
  assert.match(webView,/typeof window\.lockPullRefresh === 'function'/);
});
