import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../小手机.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../glass-theme.css', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const project = fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj', import.meta.url), 'utf8');

test('v939 web and private 1.0.63 releases are aligned', () => {
  assert.match(app, /APP_VER='v939 · 通话拒绝拦截与副模型兜底'/);
  assert.match(html, /__NORTH_SHELL_BUILD__='939'/);
  assert.equal((project.match(/CURRENT_PROJECT_VERSION = 63;/g) || []).length, 12);
  assert.equal((project.match(/MARKETING_VERSION = 1\.0\.63;/g) || []).length, 12);
});

test('first glass page reserves a non-shrinking line box for every app name', () => {
  assert.match(html, /\.app \.app-label\{[^}]*height:20px;[^}]*min-height:20px;[^}]*flex:0 0 20px;[^}]*line-height:20px/);
  for (const slot of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
    assert.match(css, new RegExp(`glass-place-app-${slot}\\{[^}]*height:90px`));
  }
  assert.match(css, /\.glass-reference-page \.app>span\{[^}]*min-height:20px!important;[^}]*flex:0 0 20px!important/);
});

test('iOS home-screen shell paints the bottom safe area without affecting Android or the private app', () => {
  assert.doesNotMatch(html, /html\.north-ios-pwa-shell \.phone/);
  assert.match(html, /系统底栏位于网页层外/);
  assert.match(html, /--north-ios-home-safe-bottom:max\(env\(safe-area-inset-bottom,0px\),34px\)/);
  assert.match(html, /html\.north-ios-home-safe \.tabbar\{[^}]*padding-bottom:var\(--north-ios-home-safe-bottom\)/);
  assert.match(app, /root\.classList\.remove\('north-ios-pwa-shell'\)/);
  assert.match(app, /root\.classList\.toggle\('north-ios-home-safe',browser\)/);
  assert.match(app, /root\.classList\.toggle\('north-apple-remote-safe',on\)/);
  assert.match(app, /苹果兼容适配<br>/);
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

test('long-press dragging starts reliably on Android and keeps page scrolling on both mobile systems', () => {
  assert.match(css, /html\.north-glass-ui \.home\.home-editing \.home-scroll\{padding-top:38px\}/);
  assert.match(css, /html\.north-glass-ui #homeDesktop \.home-item\{touch-action:none\}/);
  assert.match(app, /opacity:\.94;transform:none/);
  assert.match(app, /p\.pan=ax>ay\?'x':'y'/);
  assert.match(app, /p\.sw\.scrollLeft=p\.swLeft-dx/);
  assert.match(app, /p\.scroll\.scrollTop=p\.scrollTop-dy/);
  assert.match(app, /function appTouchMove\(e\)\{if\(!_aDrag\)return;[\s\S]*?e\.preventDefault\(\);appGhostMove\(t\.clientX,t\.clientY\)/);
  assert.match(app, /function appTouchEnd\(e\)\{if\(!_aDrag\)return;[\s\S]*?appDrop\(t\.clientX,t\.clientY\)/);
  assert.match(app, /function appDrop\(x,y\)\{const d=_aDrag;if\(d&&Number\.isFinite\(x\)&&Number\.isFinite\(y\)\)appLiveReorder\(x,y\);_aDrag=null;_aPend=null;clearTimeout\(_aTimer\)/);
  assert.match(app, /addEventListener\('touchmove',appTouchMove,\{passive:false\}\)/);
});
