import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');
const html=read('../小手机.html');
const app=read('../app.js');
const bundledHtml=read('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html');
const bundledApp=read('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js');

test('phone safe-area changes are scoped to the web iOS home compatibility class',()=>{
  assert.match(html,/html\.north-ios-home-safe \.phoneui \.phtop\{padding-top:calc\(12px \+ var\(--north-ios-home-safe-top\)\)/);
  assert.match(html,/html\.north-ios-home-safe \.phcallperson \.avatar\{width:94px;height:94px/);
  assert.match(html,/html\.north-ios-home-safe \.phcallsub\{flex:1;min-height:92px;[^}]*overflow-y:auto/);
  assert.match(html,/html\.north-ios-home-safe \.phcallctl svg\{width:60px;height:60px/);
  assert.match(html,/html\.north-ios-home-safe \.phendbtn\{width:66px;height:66px/);
  assert.doesNotMatch(html,/html\.north-native-app[^}]*\.phcall/,'private App telephone layout must not inherit the web-only fix');
  assert.match(bundledHtml,/html\.north-ios-home-safe \.phoneui \.phtop/,'the private bundle may share the CSS but only the web compatibility class can activate it');
  assert.match(bundledApp,/function appleHomeCompatEnvironment\(\)\{return appleHomeCompatBrowserEnvironment\(\);\}/);
});

test('video call preview grows while Apple-compatible web titles avoid the status bar',()=>{
  assert.match(html,/\.callscreen\.video\.active \.cav\{[^}]*width:108px;height:152px/);
  assert.match(html,/html\.north-ios-home-safe \.callscreen\.video:not\(\.mini\) \.cname,[\s\S]*?\.cstat\{transform:translateY\(var\(--north-ios-home-safe-top\)\)\}/);
  assert.match(bundledHtml,/\.callscreen\.video\.active \.cav\{[^}]*width:108px;height:152px/,'the synchronized private bundle uses the current video preview size');
});

test('pet navigation and room status controls move together in Apple-compatible web mode',()=>{
  assert.match(html,/html\.north-ios-home-safe \.pet-nav\{height:calc\(58px \+ var\(--north-ios-home-safe-top\)\);padding-top:var\(--north-ios-home-safe-top\)\}/);
  assert.match(html,/html\.north-ios-home-safe \.pet-world-switch,[\s\S]*?\.pet-mini-vitals\{top:calc\(67px \+ var\(--north-ios-home-safe-top\)\)\}/);
  assert.match(html,/html\.north-ios-home-safe \.pet-world \.pet-role-chip\{top:calc\(142px \+ var\(--north-ios-home-safe-top\)\)\}/);
  assert.match(bundledHtml,/html\.north-ios-home-safe \.pet-world \.pet-role-chip\{top:calc\(142px \+ var\(--north-ios-home-safe-top\)\)\}/);
  assert.match(bundledApp,/function appleHomeCompatEnvironment\(\)\{return appleHomeCompatBrowserEnvironment\(\);\}/,'native App must not activate the web-only Apple layout class');
});

test('Apple bottom-bar diagnostic settings row is removed from web and private sources',()=>{
  assert.doesNotMatch(app,/苹果底栏诊断/);
  assert.doesNotMatch(bundledApp,/苹果底栏诊断/);
  assert.doesNotMatch(app,/onclick="northViewportDiagnosticStart\(true\)"/);
  assert.doesNotMatch(bundledApp,/onclick="northViewportDiagnosticStart\(true\)"/);
});

test('lock-screen pull arrow is force-hidden outside the first home page in web and private sources',()=>{
  for(const source of [app,bundledApp]){
    assert.match(source,/cur\(\)\.p==='home'&&homePageClamp\(_homePage\)===0&&!_call/);
    assert.match(source,/e\.style\.display=on\?'':'none'/);
    assert.match(source,/e\.setAttribute\('aria-hidden',on\?'false':'true'\)/);
  }
});
