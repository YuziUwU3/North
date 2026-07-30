import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

function functionSource(name) {
  const plain = source.indexOf(`function ${name}(`);
  const asyncStart = source.indexOf(`async function ${name}(`);
  const start = plain >= 0 ? plain : asyncStart;
  assert.ok(start >= 0, `missing ${name}`);
  const brace = source.indexOf("{", start);
  let depth = 0, quote = "", escaped = false;
  for (let i = brace; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; continue; }
    if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

test("remote control opens contacts, then new friends, before rejecting selected requests", () => {
  const enter = functionSource("remoteControlEnterNewFriends");
  assert.ok(enter.indexOf("wxTab='chats'") < enter.indexOf("wxTab='contacts'"));
  assert.ok(enter.indexOf("wxTab='contacts'") < enter.indexOf("remoteControlSetPage('newfriends')"));
  assert.match(enter, /\.tabbar \.tb/);
  assert.match(enter, /===\s*'好友'/);
  assert.doesNotMatch(enter, /includes\('通讯录'\)/);
  assert.match(enter, /===\s*'新的朋友'/);
  assert.match(source, /targetType:'newFriendList'/);
  assert.match(source, /remoteControlNewFriendChoicePlan\(c\)/);
  assert.match(source, /op:'reject_friend_request'/);
  assert.match(source, /fromNewFriendList:true/);
  assert.match(source, /remoteControlPrepareFriendReject\(a\)/);
  assert.match(functionSource("remoteControlPrepareFriendReject"), /preparedFriendReject=\{rid:a\.targetId,button:btn\}/);
  assert.match(functionSource("remoteControlExecute"), /prepared\.button\.click\(\)/);
  assert.match(functionSource("remoteControlExecute"), /x\.status==='rejected'/);
  assert.match(source, /targetType==='newFriendList'\)\{wxTab='chats';remoteControlSetPage\('wechat'\)/);
});

test("dedicated rejection always opens the real new-friends page before deciding it is empty", () => {
  const required = functionSource("remoteControlRequiredPlan");
  const run = functionSource("remoteControlRun");
  assert.match(required, /purpose==='reject_friend_requests'\)return\[\{app:'wechat',op:'view',targetName:'好友 · 新的朋友',targetType:'newFriendList'\}\]/);
  assert.doesNotMatch(required, /remoteControlNewFriendRequests\(c\)\.length\?\[\{app:'wechat'/);
  assert.doesNotMatch(run, /purpose==='reject_friend_requests'&&!required\.length/);
  assert.ok(run.indexOf("remoteControlOpenApp(a,c)") < run.indexOf("remoteControlEnterNewFriends()"));
});

test("friend-request rejection stays inside remote control and an active call ends first", () => {
  assert.match(source, /# \u62d2\u7edd\u65b0\u7684\u670b\u53cb\u7533\u8bf7\uff08\u5165\u53e3\u786c\u89c4\u5219\uff09/);
  assert.match(source, /\u62d2\u7edd\u5fae\u4fe1“\u597d\u53cb → \u65b0\u7684\u670b\u53cb”[\s\S]*?\[\u7533\u8bf7\u8fdc\u7a0b\u64cd\u63a7\][\s\S]*?\u7edd\u4e0d\u80fd\u4f7f\u7528 \[\u767b\u5f55\u5fae\u4fe1\]/);
  assert.match(source, /const wantRemoteControl=!!\(remoteControlAllowed/);
  assert.match(source, /if\(\(wantHang\|\|wantWxLogin\|\|wantRemoteControl\)[^\n]+hangupCall\(true/);
  assert.match(source, /else if\(wantRemoteControl\)setTimeout\([^\n]+remoteControlRequest/);
  assert.match(source, /\['\u901a\u8baf\u5f55','phoneContacts'\]/);
  assert.match(source, /target:'newFriendList'/);
  assert.match(source, /newFriendsOpenedAt=Date\.now\(\)/);
  assert.match(source, /尚未真实经过“好友 → 新的朋友”，不能执行拒绝/);
  assert.match(source, /purpose==='reject_friend_requests'/);
  assert.match(source, /remember\('reject_friend_requests'\)/);
  assert.match(source, /if\(!hasWx&&!hasRemote\)\{if\(requestText&&friendReject\)/);
  assert.match(source, /主屏幕点微信App → 微信底部点好友 → 好友页点新的朋友/);
  assert.match(source, /电话App和电话“通讯录”在这条任务中绝对禁止打开/);
});

test("WeChat friends and Phone contacts have distinct labels, and Me uses a line smile", () => {
  assert.match(source, /const titles=\{chats:'微信',contacts:'好友',moments:'朋友圈',me:'我'\}/);
  assert.match(source, /tb\('contacts',svgIc\('user',23\),'好友'\)/);
  assert.match(source, /tb\('me',svgIc\('smile',23\),'我'\)/);
  assert.match(source, /smile:'<circle cx="12" cy="12" r="8\.2"\/>/);
  assert.match(source, /\['通讯录','phoneContacts'\]/);
  assert.match(source, /function remoteControlDesktopKey\(app\)[\s\S]*?wechat:'wechat'/);
  assert.match(source, /remoteControlOpenApp\(a,c\)[\s\S]*?remoteControlDesktopKey\(app\)/);
});

test("the role sees only visible pending requests, avoids blanket rejection, and completes the dedicated task", () => {
  const candidates = functionSource("remoteControlNewFriendRequests");
  const choice = functionSource("remoteControlNewFriendChoicePlan");
  assert.match(candidates, /r\.status==='pending'/);
  assert.match(candidates, /friendRequestVisible\(r\)/);
  assert.match(candidates, /r\.contactId!==actorId/);
  assert.match(choice, /只挑出你真正介意/);
  assert.match(choice, /不要为了展示功能而全选/);
  assert.match(choice, /必须至少拒绝一位/);
  assert.match(choice, /普通合理申请可以保留/);
});

test("a dedicated rejection cannot leave without at least one real reject action", () => {
  const context = vm.createContext({
    _remoteCtl: { purpose: "reject_friend_requests" },
    remoteControlNewFriendRequests: () => [],
    remoteControlIntentContext: () => "",
  });
  for (const name of ["remoteControlFriendRejectActions", "remoteControlForcedFriendRejectPlan"])
    vm.runInContext(`${functionSource(name)};globalThis.${name}=${name};`, context);
  const list = [
    { id: "r1", name: "程野" },
    { id: "r2", name: "贺川" },
  ];
  const named = context.remoteControlForcedFriendRejectPlan({}, list, "先拒绝贺川");
  assert.equal(named.length, 1);
  assert.equal(named[0].targetId, "r2");
  assert.equal(named[0].op, "reject_friend_request");
  const fallback = context.remoteControlForcedFriendRejectPlan({}, list, "把在意的申请拒绝掉");
  assert.equal(fallback.length, 1);
  assert.equal(fallback[0].targetId, "r1");
});

test("the same completed remote intent is blocked from immediately starting again", () => {
  let now = 100000;
  const context = vm.createContext({
    Date: { now: () => now },
    _remoteIntentDone: { r1: { purpose: "reject_friend_requests", intentIssuedAt: 90000, at: 99000 } },
    REMOTE_REPEAT_GUARD_MS: 120000,
  });
  vm.runInContext(`${functionSource("remoteControlRepeatBlocked")};globalThis.remoteControlRepeatBlocked=remoteControlRepeatBlocked;`, context);
  assert.equal(context.remoteControlRepeatBlocked("r1", "reject_friend_requests", 0), true);
  assert.equal(context.remoteControlRepeatBlocked("r1", "reject_friend_requests", 90000), true);
  assert.equal(context.remoteControlRepeatBlocked("r1", "reject_friend_requests", 100001), false);
  now += 120001;
  assert.equal(context.remoteControlRepeatBlocked("r1", "reject_friend_requests", 0), false);
});

test("rejecting a request is idempotent and preserves the existing 24-hour record", () => {
  const contact = { id: "visitor", name: "来访者" };
  let saves = 0;
  const context = vm.createContext({
    Date,
    S: { friendRequests: [{ id: "req-1", contactId: contact.id, status: "pending", kind: "created", attempt: 1 }] },
    friendRequestsInit: () => {},
    getC: id => id === contact.id ? contact : null,
    friendMainBlocked: () => false,
    friendRetryAfterIgnore: () => { throw new Error("created request must not schedule a re-add retry"); },
    save: () => { saves++; },
  });
  vm.runInContext(`${functionSource("rejectFriendRequestRecord")};globalThis.rejectFriendRequestRecord=rejectFriendRequestRecord;`, context);
  const first = context.rejectFriendRequestRecord("req-1");
  assert.equal(first.contact, contact);
  assert.equal(context.S.friendRequests[0].status, "rejected");
  assert.ok(context.S.friendRequests[0].decidedAt > 0);
  assert.equal(context.rejectFriendRequestRecord("req-1"), null);
  assert.equal(saves, 1);
  assert.match(source, /status==='rejected'&&now-\(\+r\.decidedAt\|\|r\.time\)>=86400000/);
});
