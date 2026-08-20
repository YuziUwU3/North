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

test('v1007 web files use one cache-busting build number',()=>{
  assert.match(app,/APP_VER='v1007 · 后台收件、朋友圈上下文与内心格式修复'/);
  assert.match(app,/const url='sw\.js\?v=1007&r=v1007-background-inbox-moments-inner-1'/);
  assert.match(html,/__NORTH_SHELL_BUILD__='1007'/);
  assert.match(html,/app\.js\?v=1007/);
  assert.match(sw,/const BUILD='1007'/);
  assert.match(sw,/north-shell-v1007/);
  assert.match(index,/小手机\.html\?v=1007/);
  assert.match(repair,/小手机\.html\?v=1007/);
});

test('the private iOS package embeds web v1007 and keeps 1.0.128 delivery',()=>{
  assert.match(privateBundle,/<string>1007<\/string>/);
  assert.equal((xcode.match(/MARKETING_VERSION = 1\.0\.128;/g)||[]).length,12);
  assert.equal((xcode.match(/CURRENT_PROJECT_VERSION = 128;/g)||[]).length,12);
  assert.match(webView,/__SMALL_PHONE_PRIVATE_BUILD__ = '1\.0\.128 \(128\)'/);
  assert.match(webView,/typeof window\.lockPullRefresh === 'function'/);
});

test('settings visibly proves which web core and private build are running',()=>{
  assert.match(app,/data-build-verification="1"/);
  assert.match(app,/当前已加载：\$\{APP_VER\}/);
  assert.match(app,/私人安装包 \$\{esc\(nativeBuild\)\}/);
});
