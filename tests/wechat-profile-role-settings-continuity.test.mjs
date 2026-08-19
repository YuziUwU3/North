import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../小手机.html',import.meta.url),'utf8');

test('the four WeChat-style role pages have independent clickable routes',()=>{
  for(const name of ['renderContactInfo','renderFriendInfo','renderContactSettings','renderRoleMoments'])assert.match(app,new RegExp(`function ${name}\\(id\\)`));
  for(const route of ['friendInfo','contactSettings','roleMoments','roleFeatures'])assert.match(app,new RegExp(`c\\.p==='${route}'`));
  for(const preview of ['wechat-profile','wechat-friend-info','wechat-contact-settings','wechat-role-moments'])assert.match(app,new RegExp(preview));
  assert.match(html,/\.wx-real-profile/);
  assert.match(html,/\.wx-subpage/);
  assert.match(html,/\.wx-role-moments/);
});

test('proactive interval is stored and scheduled per role instead of globally',()=>{
  assert.match(app,/proactiveIdlePerRoleV1/);
  assert.match(app,/c\.proactive\.idleMin/);
  assert.match(app,/id="pa_idle"/);
  assert.match(app,/function saveProactiveIdle\(id\)/);
  assert.match(app,/initiativeConfiguredIntervalMs\(c\)/);
  assert.match(app,/idleMinutes:configured/);
  assert.doesNotMatch(app,/id="s_pidle"/);
});

test('an explicit arrival updates common-life status during the same chat turn',()=>{
  assert.match(app,/doorOpened=.*faceToFace=/);
  assert.match(app,/arrived=explicit\|\|doorOpened&&faceToFace/);
  assert.match(app,/source:'wechat-natural-arrival'/);
  assert.match(app,/activity:'在家',place:'玄关'/);
  assert.match(app,/stateSource&&d\.stateSource!=='schedule-auto'/);
});

test('remote facts distinguish the controlling role from the phone owner',()=>{
  assert.match(app,/你（'\+actorName\+'本人）/);
  assert.match(app,/手机主人「'\+S\.me\.name\+'」（不是你）/);
  assert.match(app,/actorOwn:x\.authorId===actorId/);
  assert.match(app,/actorOwn:x\.who===actorId/);
  assert.match(app,/本次远程操控的原始目标，执行中不得忘记/);
});
