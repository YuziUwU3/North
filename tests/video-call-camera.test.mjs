import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');
const webView=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift',import.meta.url),'utf8');
const project=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj',import.meta.url),'utf8');

function functionSource(name){
  const start=app.indexOf('function '+name+'(');
  assert.ok(start>=0,'missing '+name);
  const next=app.indexOf('\nfunction ',start+10);
  return app.slice(start,next<0?app.length:next).trim();
}

test('video call exposes a small real camera control and front/back switching',()=>{
  const render=functionSource('renderCall');
  assert.match(render,/call-camera-tools/);
  assert.match(render,/callVideoCameraToggle\(\)/);
  assert.match(render,/callVideoCameraFlip\(\)/);
  assert.match(functionSource('callVideoCameraStart'),/getUserMedia\(\{video:/);
  assert.match(functionSource('callVideoCameraStart'),/facingMode/);
  assert.match(functionSource('callVideoCameraFlip'),/environment/);
  assert.match(html,/\.call-camera-tools\{position:absolute;right:max\(12px,env\(safe-area-inset-right\)\);bottom:max\(14px,env\(safe-area-inset-bottom\)\)/);
  assert.match(html,/\.call-camera-tools button\{width:32px;height:32px/,'the camera button remains intentionally small');
});

test('camera frames use the existing vision route and feed a natural in-call reply',()=>{
  const analyze=functionSource('callVideoVisionAnalyze');
  assert.match(analyze,/visionAPI\(data/);
  assert.match(analyze,/callAI\(note,\{videoVision:true\}\)/);
  assert.match(analyze,/videoVisionMaxPerCall\(\)/);
  assert.match(functionSource('callVideoCameraArm'),/videoVisionIntervalSec\(\)/);
  assert.match(functionSource('callOnUserSay'),/callVideoVisionAsked\(t\)&&callVideoVisionCanAnalyze\(\)/);
  assert.match(functionSource('callVideoVisionCanAnalyze'),/callVideoCameraOn\(\)/);
  assert.match(functionSource('callVideoVisionAsked'),/你\\s\*\(\?:看\|瞧\)/);
  assert.match(functionSource('callVideoCameraStop'),/getTracks\(\)\.forEach\(t=>t\.stop\(\)\)/);
  assert.match(functionSource('endCallTimers'),/callVideoCameraStop\('call-ended'\)/);
  assert.doesNotMatch(analyze,/msgs\([^)]*\)\.push\([^)]*data/,'raw camera images must not enter chat history');
});

test('preferences expose interval and per-call recognition limits',()=>{
  const settings=functionSource('renderSettings');
  const save=functionSource('saveSettings');
  assert.match(settings,/s_vvision_interval/);
  assert.match(settings,/s_vvision_max/);
  assert.match(save,/videoVisionIntervalSec/);
  assert.match(save,/videoVisionMaxPerCall/);
});

test('private iOS app grants bundled camera capture and declares privacy usage',()=>{
  assert.match(webView,/type == \.camera/);
  assert.match(webView,/type == \.cameraAndMicrophone/);
  assert.match(webView,/bundledPage && supportedCapture \? \.grant : \.deny/);
  assert.match(project,/INFOPLIST_KEY_NSCameraUsageDescription/);
  assert.match(project,/CURRENT_PROJECT_VERSION = 25/);
  assert.match(project,/MARKETING_VERSION = 1\.0\.25/);
});
