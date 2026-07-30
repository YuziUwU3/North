import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

test('remote control has a hard five-minute session deadline',()=>{
  assert.match(app,/REMOTE_SESSION_MAX_MS=5\*60\*1000/);
  assert.match(app,/deadlineAt:startedAt\+REMOTE_SESSION_MAX_MS/);
  assert.match(app,/remoteControlFinish\('已达到五分钟上限'\)/);
  assert.match(app,/_remoteDeadlineTimer=setTimeout/);
});

test('every inspected page is bounded and slow model calls are skipped',()=>{
  assert.match(app,/REMOTE_PAGE_MAX_MS=22000/);
  assert.match(app,/function remoteControlBeginPage\(a\)/);
  assert.ok((app.match(/remoteControlBeginPage\(a\)/g)||[]).length>=5);
  assert.match(app,/function remoteControlTimed\(task,ms,fallback\)/);
  assert.match(app,/remoteControlTimed\(remoteControlRoleReaction\(c,a,r\),6500/);
  assert.match(app,/remoteControlTimed\(remoteControlDecisionPlan\(c,ctl\.actions\),7500/);
  assert.match(app,/if\(remoteControlPageExpired\(\)\)continue/);
});

test('a claimed friend-request rejection requires the visible contacts path',()=>{
  const enter=app.indexOf('async function remoteControlEnterNewFriends');
  const contacts=app.indexOf("wxTab='contacts'",enter);
  const newFriends=app.indexOf("remoteControlSetPage('newfriends')",enter);
  const proof=app.indexOf('newFriendsOpenedAt=Date.now()',enter);
  assert.ok(enter>=0&&contacts>enter&&newFriends>contacts&&proof>newFriends);
  assert.match(app,/if\(!_remoteCtl\|\|!_remoteCtl\.newFriendsOpenedAt\)return Object\.assign\(base,\{ok:false/);
});
