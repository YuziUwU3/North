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

test('v957 web files use one cache-busting build number',()=>{
  assert.match(app,/APP_VER='v957 · 网易云官方播放器接入'/);
  assert.match(app,/const url='sw\.js\?v=957&r=v950-shell-restore-1'/);
  assert.match(html,/__NORTH_SHELL_BUILD__='957'/);
  assert.match(html,/app\.js\?v=957/);
  assert.match(sw,/const BUILD='957'/);
  assert.match(sw,/north-shell-v957/);
  assert.match(index,/小手机\.html\?v=957/);
  assert.match(repair,/小手机\.html\?v=957/);
});

test('the private iOS package advances to v957 and 1.0.79 delivery',()=>{
  assert.match(privateBundle,/<string>957<\/string>/);
  assert.equal((xcode.match(/MARKETING_VERSION = 1\.0\.79;/g)||[]).length,12);
  assert.equal((xcode.match(/CURRENT_PROJECT_VERSION = 79;/g)||[]).length,12);
  assert.match(webView,/__SMALL_PHONE_PRIVATE_BUILD__ = '1\.0\.79 \(79\)'/);
  assert.match(webView,/typeof window\.lockPullRefresh === 'function'/);
});

test('settings visibly proves which web core and private build are running',()=>{
  assert.match(app,/data-build-verification="1"/);
  assert.match(app,/当前已加载：\$\{APP_VER\}/);
  assert.match(app,/私人安装包 \$\{esc\(nativeBuild\)\}/);
});
