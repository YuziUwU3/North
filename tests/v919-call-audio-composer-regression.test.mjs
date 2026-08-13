import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const app = read('app.js');
const html = read('小手机.html');
const pip = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/CallPictureInPictureController.swift');

test('ordinary voice and video calls reactivate iOS audio before role playback', () => {
  const play = pip.match(/func playAudio\(data: Data[\s\S]*?func stopAudio/)?.[0] ?? '';
  assert.match(play, /stopAudio\(\)[\s\S]*?activateCallAudio\(\)[\s\S]*?AVAudioPlayer/);
  assert.match(play, /guard player\.play\(\)/);
});

test('the v917 hands-free result path is restored without touching subtitle animation', () => {
  assert.doesNotMatch(app, /function callHFLooksLikePlayback/);
  assert.doesNotMatch(app, /callHFRememberRoleSpeech/);
  assert.match(app, /if\(_callHFBusy\|\|_callBusy\)\{_callHFPending\.push/);
  assert.match(app, /const CALL_SUBTITLE_MOTION=\{phraseDurationMs:300,translateY:8,scale:0\.98,x1:0\.25,y1:0\.1,x2:0\.25,y2:1\}/);
  assert.match(app, /function callSubtitleEnter\(box\)/);
  assert.match(html, /@keyframes csphrasein/);
});

test('chat composer stays above the sticker panel and iOS does not zoom a 15px textarea', () => {
  assert.match(html, /\.inputbar textarea\{[^}]*box-sizing:border-box;[^}]*font-size:16px;[^}]*min-height:36px/);
  assert.match(html, /#panel\{order:2;flex:0 0 auto;\}/);
  assert.match(app, /function chatPanelKeyboardDismiss\(\)/);
  assert.match(app, /function chatPanelOpen\(page\)/);
  assert.match(app, /function chatPanelToggle\(\)/);
  assert.match(app, /onclick="chatPanelToggle\(\)"/);
});
