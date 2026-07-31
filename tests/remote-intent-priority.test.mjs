import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

test('v728 autonomy is not replaced by a forced single-purpose planner',()=>{
  assert.doesNotMatch(app,/function remoteControlFocusedPlan\(/);
  assert.doesNotMatch(app,/function remoteControlIntentPriority\(/);
  assert.doesNotMatch(app,/reject_friend_requests/);
  assert.doesNotMatch(app,/remoteControlForcedFriendRejectPlan/);
});

test('the role still decides and orders the remote-control plan',()=>{
  const start=app.indexOf('async function remoteControlOrderPlan');
  const end=app.indexOf('function remoteControlNormalizePlan',start);
  const body=app.slice(start,end);
  assert.ok(start>=0&&end>start);
  assert.match(body,/chatAPI\(/);
  assert.match(body,/temp:\.86/);
  assert.match(body,/return order\.length\?order\.flatMap/);
  assert.match(body,/picked\.forEach/);
  assert.doesNotMatch(body,/picked\.concat\(apps\)/);
  assert.match(body,/hintApps\.length\?hintApps:apps\.slice\(0,2\)/);
  assert.match(body,/remoteControlContextWantsBroad\(ctx\)/);
});

test('mentioning a rejection never auto-injects a remote-control request',()=>{
  assert.doesNotMatch(app,/phoneInspectionFriendRejectIntent/);
  assert.doesNotMatch(app,/phoneInspectionForceRemote/);
  assert.doesNotMatch(app,/remoteControlAutoStart/);
});
