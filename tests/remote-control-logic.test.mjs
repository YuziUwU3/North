import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');

test('restore-all sessions still enable every closed couple permission',()=>{
  assert.match(app,/function phoneInspectionRestoreAllPermissionsIntent\(text\)/);
  assert.match(app,/restore_all_permissions/);
  assert.match(app,/purpose==='restore_all_permissions'/);
  assert.match(app,/filter\(x=>!x\.enabled\)[\s\S]*?enable_couple_permission/);
  assert.match(app,/ctl\.purpose==='restore_all_permissions'\?\[\]/);
});

test('restore-all can continue with a small context-driven inspection',()=>{
  assert.match(app,/function remoteControlRunRestoreAll\(c\)/);
  assert.match(app,/function remoteControlAfterRestorePlan\(c\)/);
  assert.match(app,/remoteControlAfterRestorePlan\(c\)/);
  assert.match(app,/function remoteControlContextCandidates\(c\)/);
  assert.match(app,/targetType:'wechatList'/);
  assert.match(app,/candidates\.slice\(0,2\)/);
});

test('remote control keeps chat context but lets the role choose order',()=>{
  assert.match(app,/_remoteIntentContext/);
  assert.match(app,/intentContext=String\(_remoteIntentContext\[cid\]\|\|''\)\.slice\(-1600\)/);
  assert.match(app,/function remoteControlIntentContext\(c\)/);
  assert.match(app,/function remoteControlMentionedWechatTargets\(c\)/);
  assert.match(app,/contextMentioned:true/);
  assert.doesNotMatch(app,/if\(required\.some\(a=>a&&a\.contextMentioned\)\)return required\.filter\(a=>a&&a\.app==='wechat'\)/);
  assert.match(app,/async function remoteControlOrderPlan\(c,required\)[\s\S]*?remoteControlIntentContext\(c\)/);
  assert.match(app,/picked\.forEach/);
});

test('phone contacts and SMS remain actionable remote targets',()=>{
  assert.match(app,/function remoteControlPhoneContacts\(\)/);
  assert.match(app,/function remoteControlSmsThreads\(\)/);
  assert.match(app,/function remoteControlDeletePhoneContact\(a\)/);
  assert.match(app,/function remoteControlDeleteSmsThread\(a\)/);
  assert.match(app,/'delete_phone_contact'/);
  assert.match(app,/'delete_sms_thread'/);
});

test('remote entry correction only handles contradictory role output',()=>{
  assert.match(app,/ownNonWx=phoneInspectionNonWechatIntent\(out\)/);
  assert.match(app,/if\(hasWx&&!hasRemote&&ownNonWx\)/);
  assert.doesNotMatch(app,/if\(nonWx\)\{out=out\.replace\(wxRe/);
});

test('breakup is not hard-bound to jail',()=>{
  assert.doesNotMatch(app,/if\([^\n]{0,80}breakup[^\n]{0,80}jail/i);
});
