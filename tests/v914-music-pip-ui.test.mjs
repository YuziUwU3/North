import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');
const pip=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/CallPictureInPictureController.swift',import.meta.url),'utf8');
const project=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj',import.meta.url),'utf8');

test('v914 and private 1.0.38 versions align',()=>{
  assert.match(app,/APP_VER='v914 · 悬浮通话透视与免登录在线音乐'/);
  assert.match(project,/CURRENT_PROJECT_VERSION = 38;/);
  assert.match(project,/MARKETING_VERSION = 1\.0\.38;/);
});

test('public music search needs no user login and reuses together-listen songs',()=>{
  assert.match(app,/MUSIC_PUBLIC_API='https:\/\/api\.audius\.co\/v1'/);
  assert.match(app,/tracks\/search\?query=/);
  assert.match(app,/MUSIC_PUBLIC_API\+'\/tracks\/\'\+encodeURIComponent\(id\)\+'\/stream\?app_name='\+encodeURIComponent\(MUSIC_PUBLIC_APP\)/);
  assert.match(app,/不用登录/);
  assert.match(app,/provider:'audius'/);
  assert.match(app,/function musicInviteTo\(cid\)/);
  assert.doesNotMatch(app,/musicSearch.*(?:login|password|Authorization|api[_-]?key)/i);
});

test('full call page is opaque while only native PiP is translucent',()=>{
  assert.match(html,/\.callsub\{position:absolute;bottom:190px;left:0;right:0;padding:0 26px/);
  assert.match(html,/\.callsub:empty\{display:none\}/);
  assert.doesNotMatch(html,/\.callsub\{[^}]*backdrop-filter/);
  assert.match(pip,/root\.backgroundColor = UIColor\(red: 0\.045, green: 0\.05, blue: 0\.072, alpha: 0\.38\)/);
  assert.match(pip,/root\.isOpaque = false/);
});

test('realtime share switch and share button visibly follow pending state',()=>{
  assert.match(app,/screenShareRealtimeVisionToggle\(this\)/);
  assert.match(app,/el\.classList\.toggle\('on',screenShareRealtimeVisionOn\(\)\)/);
  assert.match(app,/_callScreenPending=expected\?'start':'stop'/);
  assert.match(app,/call-screen-toggle\$\{callScreenShareOn\(\)\?' on':''\}\$\{_callScreenPending\?' pending':''\}/);
});
