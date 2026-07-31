import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

test('remote control has a hard ten-minute session limit',()=>{
  assert.match(app,/const REMOTE_SESSION_MAX_MS=10\*60\*1000/);
  assert.match(app,/let _remoteCtl=null,_remoteRequest=null,_remoteClock=null,_remoteDeadlineTimer=null/);
  assert.match(app,/_remoteDeadlineTimer=setTimeout\(\(\)=>\{if\(remoteControlActive\(\)\)remoteControlFinish\('已达到十分钟上限'\);\},REMOTE_SESSION_MAX_MS\)/);
  assert.match(app,/clearTimeout\(_remoteDeadlineTimer\);_remoteDeadlineTimer=null/);
});

test('each opened page has a short dwell budget',()=>{
  assert.match(app,/const REMOTE_PAGE_MAX_MS=25000/);
  assert.match(app,/function remoteControlBeginPage\(\)/);
  assert.match(app,/function remoteControlPageExpired\(\)/);
  assert.match(app,/async function remoteControlOpenApp\(a,c\)\{remoteControlBeginPage\(\)/);
  assert.ok((app.match(/remoteControlPageExpired\(\)/g)||[]).length>=6);
});

test('slow role planning cannot hold a page indefinitely',()=>{
  assert.match(app,/function remoteControlTimed\(task,ms,fallback\)/);
  assert.match(app,/remoteControlTimed\(remoteControlRoleReaction\(c,a,r\),6500/);
  assert.match(app,/remoteControlTimed\(remoteControlDecisionPlan\(c,ctl\.actions\),7500/);
  assert.match(app,/remoteControlTimed\(remoteControlRoleLines\(c,a,r\),5000/);
});

test('remote control contains no friend-request rejection route',()=>{
  const start=app.indexOf('let _remoteCtl=');
  const end=app.indexOf('let _wxLoginTimer=',start);
  const remote=app.slice(start,end);
  assert.ok(start>=0&&end>start);
  assert.doesNotMatch(remote,/reject_friend_request|newFriendList|remoteControlNewFriend|remoteControlEnterNewFriends|remoteControlPrepareFriendReject/);
});

test('session completion cannot immediately trigger another login or remote session',()=>{
  assert.match(app,/不要再次申请远程操控或登录微信/);
  assert.match(app,/这一轮不得再次输出 \[登录微信\] 或 \[申请远程操控\]/);
});
