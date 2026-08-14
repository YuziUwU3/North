import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../小手机.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../glass-theme.css', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const project = fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj', import.meta.url), 'utf8');

test('v927 web and private versions are aligned', () => {
  assert.match(app, /APP_VER='v927 · 苹果首屏文字、安全区与美化导入修复'/);
  assert.match(html, /__NORTH_SHELL_BUILD__='927'/);
  assert.equal((project.match(/CURRENT_PROJECT_VERSION = 53;/g) || []).length, 12);
  assert.equal((project.match(/MARKETING_VERSION = 1\.0\.53;/g) || []).length, 12);
});

test('first glass page reserves a non-shrinking line box for every app name', () => {
  assert.match(html, /\.app \.app-label\{[^}]*height:20px;[^}]*min-height:20px;[^}]*flex:0 0 20px;[^}]*line-height:20px/);
  for (const slot of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
    assert.match(css, new RegExp(`glass-place-app-${slot}\\{[^}]*height:90px`));
  }
  assert.match(css, /\.glass-reference-page \.app>span\{[^}]*min-height:20px!important;[^}]*flex:0 0 20px!important/);
});

test('iOS home-screen safe shell fills the viewport only through the compatibility class', () => {
  assert.match(html, /html\.north-ios-home-safe \.phone\{position:fixed;inset:0;width:100%;height:auto;min-height:0;max-height:none\}/);
  assert.match(app, /root\.classList\.toggle\('north-ios-home-safe',browser\)/);
  assert.match(app, /browser=appleHomeCompatBrowserEnvironment\(\)&&on/);
});

test('beauty packs never overwrite page, widget, or Dock placement', () => {
  const exported = app.match(/me:pickObj\(me,\[([^\]]+)\]\),/s)?.[1] || '';
  const imported = app.match(/beautyAssign\(S\.me,pack\.me,\[([^\]]+)\]\)/s)?.[1] || '';
  for (const key of ['widgets', 'appLayout', 'homeLayout', 'appDock', 'homeReferenceAppSlots']) {
    assert.doesNotMatch(exported, new RegExp(`['"]${key}['"]`));
    assert.doesNotMatch(imported, new RegExp(`['"]${key}['"]`));
  }
  assert.match(exported, /'homeBg'/);
  assert.match(imported, /'appIcons'/);
});

test('long-press dragging keeps the icon under the finger and survives iOS touch delivery', () => {
  assert.match(css, /html\.north-glass-ui \.home\.home-editing \.home-scroll\{padding-top:38px\}/);
  assert.match(app, /opacity:\.94;transform:none/);
  assert.match(app, /function appTouchMove\(e\)\{if\(!_aDrag\)return;[\s\S]*?e\.preventDefault\(\);appGhostMove\(t\.clientX,t\.clientY\)/);
  assert.match(app, /function appTouchEnd\(e\)\{if\(!_aDrag\)return;[\s\S]*?appDrop\(t\.clientX,t\.clientY\)/);
  assert.match(app, /function appDrop\(x,y\)\{const d=_aDrag;_aDrag=null;_aPend=null;clearTimeout\(_aTimer\)/);
  assert.match(app, /addEventListener\('touchmove',appTouchMove,\{passive:false\}\)/);
});
