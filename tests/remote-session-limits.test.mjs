import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

test('the restored v728 core has no later forced deadline machinery',()=>{
  assert.doesNotMatch(app,/REMOTE_SESSION_MAX_MS/);
  assert.doesNotMatch(app,/REMOTE_PAGE_MAX_MS/);
  assert.doesNotMatch(app,/_remoteDeadlineTimer/);
  assert.doesNotMatch(app,/remoteControlBeginPage/);
});

test('a friend-request rejection must traverse the visible WeChat Friends path',()=>{
  const enter=app.indexOf('async function remoteControlEnterNewFriends');
  const wechat=app.indexOf("remoteControlSetPage('wechat')",enter);
  const friends=app.indexOf("includes('好友')",enter);
  const newFriends=app.indexOf("==='新的朋友'",enter);
  assert.ok(enter>=0&&wechat>enter&&friends>wechat&&newFriends>friends);
});

test('success is impossible without clicking and verifying the visible reject button',()=>{
  assert.match(app,/querySelector\('button\.reject'\)/);
  assert.match(app,/prepared\.button\.click\(\)/);
  assert.match(app,/req\.status!=='rejected'/);
});
