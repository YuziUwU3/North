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

test('v933 web files use one cache-busting build number',()=>{
  assert.match(app,/APP_VER='v933 · 苹果主页箭头与输入栏修复'/);
  assert.match(app,/const url='sw\.js\?v=933'/);
  assert.match(html,/__NORTH_SHELL_BUILD__='933'/);
  assert.match(html,/app\.js\?v=933/);
  assert.match(sw,/const BUILD='933'/);
  assert.match(sw,/north-shell-v933/);
  assert.match(index,/小手机\.html\?v=933/);
  assert.match(repair,/小手机\.html\?v=933/);
});

test('the private iOS package is aligned with the shared v933 core',()=>{
  assert.match(privateBundle,/<string>933<\/string>/);
  assert.equal((xcode.match(/MARKETING_VERSION = 1\.0\.57;/g)||[]).length,12);
  assert.equal((xcode.match(/CURRENT_PROJECT_VERSION = 57;/g)||[]).length,12);
  assert.match(webView,/__SMALL_PHONE_PRIVATE_BUILD__ = '1\.0\.57 \(57\)'/);
  assert.match(webView,/typeof window\.lockPullRefresh === 'function'/);
});
