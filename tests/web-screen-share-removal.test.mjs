import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const bridge=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift',import.meta.url),'utf8');
const coordinator=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/ScreenShareCoordinator.swift',import.meta.url),'utf8');
const broadcast=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneScreenBroadcast/SampleHandler.swift',import.meta.url),'utf8');

test('the web build exposes no display-capture capability',()=>{
  assert.doesNotMatch(app,/getDisplayMedia/);
  assert.match(app,/function screenShareAvailable\(\)\{return privateNativeAppOn\(\);\}/);
  assert.match(app,/const shareTool=_call\.state==='active'&&screenShareAvailable\(\)\?/);
  assert.match(app,/if\(screenShareAvailable\(\)\)cf\+='\\n- 屏幕共享当前状态/);
  assert.match(app,/if\(screenShareAvailable\(\)&&!screenShareReason\)/);
});

test('settings and role requests are rendered only inside the private app',()=>{
  assert.match(app,/\$\{screenShareAvailable\(\)\?`<div class="it"><span>实时共享理解/);
  assert.match(app,/function callScreenShareRequest\(reason\)\{if\(!screenShareAvailable\(\)\|\|/);
  assert.match(app,/function callScreenShareToggle\(\)\{if\(!screenShareAvailable\(\)\|\|/);
});

test('the private ReplayKit implementation and native bridge remain intact',()=>{
  assert.match(bridge,/case "screenShare\.start", "screenShare\.stopPrompt"/);
  assert.match(bridge,/case "screenShare\.realtime\.frame"/);
  assert.match(coordinator,/final class ScreenShareCoordinator/);
  assert.match(broadcast,/import ReplayKit/);
  assert.match(app,/screenShare\.realtime\.frame/);
  assert.match(app,/window\.__smallPhoneScreenShareEvent=callScreenShareNativeEvent/);
});
