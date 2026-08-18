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

test('v985 web files use one cache-busting build number',()=>{
  assert.match(app,/APP_VER='v985 · 情侣目标经期与设备管控'/);
  assert.match(app,/const url='sw\.js\?v=985&r=v985-couple-goals-period-control-1'/);
  assert.match(html,/__NORTH_SHELL_BUILD__='985'/);
  assert.match(html,/app\.js\?v=985/);
  assert.match(sw,/const BUILD='985'/);
  assert.match(sw,/north-shell-v985/);
  assert.match(index,/小手机\.html\?v=985/);
  assert.match(repair,/小手机\.html\?v=985/);
});

test('the private iOS package embeds web v985 and keeps 1.0.106 delivery',()=>{
  assert.match(privateBundle,/<string>985<\/string>/);
  assert.equal((xcode.match(/MARKETING_VERSION = 1\.0\.106;/g)||[]).length,12);
  assert.equal((xcode.match(/CURRENT_PROJECT_VERSION = 106;/g)||[]).length,12);
  assert.match(webView,/__SMALL_PHONE_PRIVATE_BUILD__ = '1\.0\.106 \(106\)'/);
  assert.match(webView,/typeof window\.lockPullRefresh === 'function'/);
});

test('settings visibly proves which web core and private build are running',()=>{
  assert.match(app,/data-build-verification="1"/);
  assert.match(app,/当前已加载：\$\{APP_VER\}/);
  assert.match(app,/私人安装包 \$\{esc\(nativeBuild\)\}/);
});
