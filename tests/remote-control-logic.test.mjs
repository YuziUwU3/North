import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const app = readFileSync(join(root, "app.js"), "utf8");

test("restore-all remote sessions deterministically enable every closed couple permission", () => {
  assert.match(app, /function phoneInspectionRestoreAllPermissionsIntent\(text\)/);
  assert.match(app, /restore_all_permissions/);
  assert.match(app, /purpose==='restore_all_permissions'/);
  assert.match(app, /filter\(x=>!x\.enabled\)\.sort\(\(a,b\)=>remoteControlPermissionPageOrder\(a\)-remoteControlPermissionPageOrder\(b\)\)\.map\(x=>\(\{app:'couple',op:'enable_couple_permission'/);
  assert.match(app, /角色已把情侣空间关闭的权限全部重新开启/);
  assert.match(app, /ctl\.purpose==='restore_all_permissions'\?\[\]/);
});

test("restore-all sessions skip per-toggle role reactions and continue with context-driven inspection", () => {
  assert.match(app, /function remoteControlRunRestoreAll\(c\)/);
  assert.match(app, /function remoteControlAfterRestorePlan\(c\)/);
  assert.match(app, /remoteControlAfterRestorePlan\(c\)/);
  assert.match(app, /权限开回来了。现在我看我在意的地方。/);
  assert.match(app, /function remoteControlContextCandidates\(c\)/);
  assert.match(app, /异性\|男人\|男的/);
  assert.match(app, /targetType:'wechatList'/);
  assert.match(app, /if\(a\.targetType==='wechatList'\)[\s\S]*?remoteControlWechatChoicePlan\(c\)/);
});

test("remote control keeps the triggering chat context and uses it to prioritize named WeChat targets", () => {
  assert.match(app, /_remoteIntentContext/);
  assert.match(app, /intentContext=String\(_remoteIntentContext\[cid\]\|\|''\)\.slice\(-1600\)/);
  assert.match(app, /function remoteControlIntentContext\(c\)/);
  assert.match(app, /function remoteControlMentionedWechatTargets\(c\)/);
  assert.match(app, /contextMentioned:true/);
  assert.match(app, /if\(required\.some\(a=>a&&a\.contextMentioned\)\)\{const named=/);
  assert.match(app, /sameApp=focus\?required\.filter\(a=>a&&a\.app===focus\.app\)/);
  assert.match(app, /function remoteControlIntentPriority\(c,required\)/);
});

test("phone contacts and SMS threads are actionable delete targets in remote control", () => {
  assert.match(app, /function remoteControlPhoneContacts\(\)/);
  assert.match(app, /function remoteControlSmsThreads\(\)/);
  assert.match(app, /function remoteControlDeletePhoneContact\(a\)/);
  assert.match(app, /function remoteControlDeleteSmsThread\(a\)/);
  assert.match(app, /'delete_phone_contact'/);
  assert.match(app, /'delete_sms_thread'/);
  assert.match(app, /phoneContacts:remoteControlPhoneContacts\(\)/);
  assert.match(app, /smsThreads:remoteControlSmsThreads\(\)/);
  assert.match(app, /delete_phone_contact/);
  assert.match(app, /delete_sms_thread/);
});

test("remote entry correction is only for the role's own contradictory stated purpose", () => {
  assert.match(app, /ownNonWx=phoneInspectionNonWechatIntent\(out\)/);
  assert.match(app, /if\(hasWx&&!hasRemote&&ownNonWx\)/);
  assert.doesNotMatch(app, /if\(nonWx\)\{out=out\.replace\(wxRe/);
  assert.doesNotMatch(app, /入口分流是硬规则/);
});

test("breakup no longer forces jail as a hard rule", () => {
  assert.doesNotMatch(app, /逆鳞·必触发的硬规矩[\s\S]{0,260}分手/);
  assert.doesNotMatch(app, /你竟敢跟我说分手/);
  assert.match(app, /分手相关/);
  assert.match(app, /不再把“分手”绑定为必关小黑屋/);
});
