import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const app = read('app.js');
const html = read('小手机.html');
const pet = read('pet-game.js');
const bridge = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift');
const webView = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift');
const pip = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/CallPictureInPictureController.swift');

test('user and role subtitles both use the v700 complete-phrase reveal', () => {
  assert.match(app, /function updateCallSub\(\)/);
  assert.match(app, /function callSubtitleEnter\(box\)/);
  assert.match(html, /@keyframes csphrasein/);
  assert.doesNotMatch(html, /@keyframes cscharin/);
  assert.match(pip, /subtitleLabel\.alpha = 0/);
  assert.match(pip, /duration: 0\.3/);
  assert.match(pip, /length > 130 \? 9\.5 : \(length > 80 \? 11 : 14\)/);
});

test('main call subtitle restores v850 size and vertical position without changing PiP sizing', () => {
  assert.match(html, /\.callsub\{[^}]*bottom:190px;[^}]*align-items:center;[^}]*justify-content:center/);
  assert.match(html, /\.csline\{[^}]*font-size:18px/);
  assert.doesNotMatch(html, /\.csline\.compact/);
  assert.doesNotMatch(html, /\.csline\.dense/);
  assert.doesNotMatch(app, /function callSubtitleSizeClass/);
  assert.match(pip, /length > 130 \? 9\.5 : \(length > 80 \? 11 : 14\)/);
});

test('background role audio can reactivate the mixed native call session', () => {
  assert.match(pip, /func playAudio\([\s\S]*?data: Data,[\s\S]*?mixWithMedia: Bool = false/);
  assert.match(pip, /guard player\.play\(\)/);
  assert.match(pip, /options: \[\.defaultToSpeaker, \.allowBluetoothHFP, \.mixWithOthers\]/);
  assert.match(pip.match(/func playAudio[\s\S]*?func stopAudio/)?.[0] ?? '', /stopAudio\(\)[\s\S]*?activateCallAudio\(mixWithMedia: mixWithMedia\)[\s\S]*?AVAudioPlayer/);
  assert.doesNotMatch(bridge, /if !audioSessionConfigured/);
});

test('hands-free final results use the v800-v850 busy-period rejection path', () => {
  assert.doesNotMatch(bridge, /lastVoiceActivityAt/);
  assert.doesNotMatch(bridge, /rms >= 0\.008/);
  assert.doesNotMatch(bridge, /event\["voiceActivity"\]/);
  assert.doesNotMatch(webView, /voiceActivity: payload\.voiceActivity !== false/);
  assert.doesNotMatch(app, /function callHFLooksLikePlayback/);
  assert.doesNotMatch(app, /callHFRememberRoleSpeech/);
  assert.match(app, /if\(!_callHF\|\|_callHFBusy\|\|_callBusy\|\|Date\.now\(\)<_hfIgnoreUntil\)return/);
  assert.doesNotMatch(app, /_callHFPending\.push\(\{text:t,meta\}\)/);
});

test('voice and video calls expose real screen sharing only in the private app', () => {
  assert.match(app, /const shareTool=_call\.state==='active'&&screenShareAvailable\(\)/);
  assert.match(app, /\$\{cameraView\}\$\{shareTool\}/);
  assert.match(app, /function callScreenShareRequest\(reason\)\{if\(!screenShareAvailable\(\)\|\|!_call\|\|_call\.state!=='active'/);
  assert.doesNotMatch(app, /getDisplayMedia/);
  assert.match(app, /callVideoVisionAnalyze\(trigger,spoken,meta\)\{if\(!_call\|\|_call\.state!=='active'\|\|\(_call\.kind!=='video'&&!callScreenShareOn\(\)\)\)/);
});

test('all sleeping animals use separate slots inside the left pink bed', () => {
  assert.match(pet, /1:\[\{x:20\.5,y:45\.0\}\]/);
  assert.match(pet, /4:\[\{x:15\.1,y:42\.7\},\{x:25\.9,y:42\.7\},\{x:15\.1,y:47\.1\},\{x:25\.9,y:47\.1\}\]/);
  assert.match(pet, /total>=4\?9\.5/);
});

test('role profile keeps old test shortcuts removed while settings owns the requested real push test', () => {
  assert.doesNotMatch(app, /查看当前软件立即测试/);
  assert.doesNotMatch(app, /一分钟后台通知真实测试/);
  assert.doesNotMatch(app, /function roleAppWatchImmediateTest/);
  assert.match(app, /function roleServerPushOneMinuteTest/);
  assert.match(app, /roleServerPushSettingsTestHTML/);
});
