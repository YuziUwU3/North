import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const bridge = fs.readFileSync(
  new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift', import.meta.url),
  'utf8'
);
const pip = fs.readFileSync(
  new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/CallPictureInPictureController.swift', import.meta.url),
  'utf8'
);

test('web and native PiP share one subtitle motion contract', () => {
  assert.match(app, /const CALL_SUBTITLE_MOTION=\{charDurationMs:420,charStaggerMs:24,maxDelayMs:420,lineDurationMs:260,translateY:5,scale:0\.96,charX1:0\.25,charY1:0\.1,charX2:0\.25,charY2:1,lineX1:0\.22,lineY1:0\.78,lineX2:0\.23,lineY2:1\}/);
  assert.match(app, /subtitleWho:s&&s\.who==='me'\?'me':'them'/);
  assert.match(app, /subtitleMotion:CALL_SUBTITLE_MOTION/);
  assert.match(bridge, /let subtitleMotion = arguments\["subtitleMotion"\]/);
  assert.match(pip, /private final class CallSubtitleView/);
  assert.match(pip, /let isAppend = who == currentWho && text\.hasPrefix\(currentText\)/);
  assert.match(pip, /"charDurationMs": 420/);
  assert.match(pip, /"charStaggerMs": 24/);
  assert.match(pip, /motion\["lineX1"\] \?\? 0\.22/);
  assert.match(pip, /"translateY": 5/);
  assert.doesNotMatch(pip, /private var subtitleAnimator: UIViewPropertyAnimator/);
});

test('PiP updates no longer restart PiP or reactivate the global audio session', () => {
  const updateCase = bridge.match(/case "call\.pip\.update":([\s\S]*?)case "call\.pip\.end":/)?.[1] ?? '';
  assert.match(updateCase, /CallPictureInPictureController\.shared\.update/);
  assert.doesNotMatch(updateCase, /\.start\(/);
  assert.doesNotMatch(updateCase, /AVAudioSession/);
});

test('native hands-free keeps capture alive while role audio plays', () => {
  assert.match(bridge, /try input\.setVoiceProcessingEnabled\(true\)/);
  assert.match(bridge, /options: \[\.defaultToSpeaker, \.allowBluetoothHFP, \.mixWithOthers\]/);
  assert.doesNotMatch(app, /hfAudioPaused=true;await callHFPauseForRoleAudio\(\)/);
  assert.doesNotMatch(app, /_hfIgnoreUntil=Math\.max\(_hfIgnoreUntil,Date\.now\(\)\+1500\)/);
  assert.match(app, /_callHFPending\.push\(\{text:t,meta\}\)/);
  assert.match(app, /const pending=_callHFPending\.shift\(\)/);
});
