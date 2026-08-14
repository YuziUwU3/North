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

test('v930 web files use one cache-busting build number',()=>{
  assert.match(app,/APP_VER='v930 · 网页故障修复与苹果底栏诊断'/);
  assert.match(app,/const url='sw\.js\?v=930'/);
  assert.match(html,/__NORTH_SHELL_BUILD__='930'/);
  assert.match(html,/app\.js\?v=930/);
  assert.match(sw,/const BUILD='930'/);
  assert.match(sw,/north-shell-v930/);
  assert.match(index,/小手机\.html\?v=930/);
  assert.match(repair,/小手机\.html\?v=930/);
});

test('the diagnostic web release does not silently change the private iOS package',()=>{
  assert.match(privateBundle,/<string>929<\/string>/);
  assert.match(xcode,/MARKETING_VERSION = 1\.0\.54;/);
  assert.match(xcode,/CURRENT_PROJECT_VERSION = 54;/);
});
