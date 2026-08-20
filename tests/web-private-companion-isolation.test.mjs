import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');

test('web couple space hides every companion entry while private app keeps it', () => {
  assert.match(app, /function privateCompanionAppOn\(\)\{return privateNativeAppOn\(\);\}/);
  assert.match(app, /privateCompanion=privateCompanionAppOn\(\);if\(!privateCompanion&&_couTab===3\)_couTab=1/);
  assert.match(app, /\$\{privateCompanion\?`<button class="minibtn" id="coutab3"/);
  assert.match(app, /\$\{privateCompanion\?`<div id="coupage3"/);
  assert.match(app, /filter\(x=>privateCompanionAppOn\(\)\|\|!\/coupleJump\\\(3,/);
});

test('web contact settings do not expose APNs or companion app-use controls', () => {
  assert.match(app, /\$\{privateCompanionAppOn\(\)\?`<div class="it"><span>关闭小手机后仍可主动联系/);
  assert.match(app, /知道我正在用哪个软件/);
  assert.match(app, /每天最多查看软件次数/);
});

test('shared timers and stale web data cannot call the private companion cloud', () => {
  assert.match(app, /async function companionRpc\(name,args\)\{if\(!privateCompanionAppOn\(\)\)throw new Error\('伴生云只在私人小手机 App 内可用'\)/);
  assert.match(app, /companionPollSnapshot=async function\(force\)\{if\(!privateCompanionAppOn\(\)\)return false/);
  assert.match(app, /companionNotifyNative=async function\(commandId\)\{if\(!privateCompanionAppOn\(\)\)return \{pushed:false,reason:'private-app-only'\}/);
  assert.match(app, /roleBackgroundEnqueue=async function\(\.\.\.args\)\{if\(!privateCompanionAppOn\(\)\)return null/);
  assert.match(app, /roleBackgroundDispatchNow=async function\(\)\{if\(!privateCompanionAppOn\(\)\)return false/);
  assert.match(app, /roleServerPushPull=async function\(force\)\{if\(!privateCompanionAppOn\(\)\)return false/);
});

test('role prompts and action tags cannot leak private-device facts into web replies', () => {
  assert.match(app, /companionRolePrompt=function\(c,opt\)\{return privateCompanionAppOn\(\)\?companionRolePromptPrivateCore\(c,opt\):'';\}/);
  assert.match(app, /companionAmbientContext=function\(c,now\)\{return privateCompanionAppOn\(\)\?companionAmbientContextPrivateCore\(c,now\):'';\}/);
  assert.match(app, /companionApplyReadTags=function\(content,c\)\{return privateCompanionAppOn\(\)\?companionApplyReadTagsPrivateCore\(content,c\):\{content:String\(content\|\|''\),changed:false\};\}/);
});
