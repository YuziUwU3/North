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
  assert.ok(enter.indexOf("wxTab='contacts'") < enter.indexOf("remoteControlSetPage('newfriends')"));
  assert.match(enter, /\.tabbar \.tb/);
  assert.match(enter, /===\s*'新的朋友'/);
  assert.match(source, /targetType:'newFriendList'/);
  assert.match(source, /remoteControlNewFriendChoicePlan\(c\)/);
  assert.match(source, /op:'reject_friend_request'/);
  assert.match(source, /fromNewFriendList:true/);
  assert.match(source, /remoteControlPrepareFriendReject\(a\)/);
});

test("friend-request rejection stays inside remote control and an active call ends first", () => {
  assert.match(source, /# \u62d2\u7edd\u65b0\u7684\u670b\u53cb\u7533\u8bf7\uff08\u5165\u53e3\u786c\u89c4\u5219\uff09/);
  assert.match(source, /\u62d2\u7edd\u5fae\u4fe1“\u901a\u8baf\u5f55 → \u65b0\u7684\u670b\u53cb”[\s\S]*?\[\u7533\u8bf7\u8fdc\u7a0b\u64cd\u63a7\][\s\S]*?\u7edd\u4e0d\u80fd\u4f7f\u7528 \[\u767b\u5f55\u5fae\u4fe1\]/);
  assert.match(source, /const wantRemoteControl=!!\(remoteControlAllowed/);
  assert.match(source, /if\(\(wantHang\|\|wantWxLogin\|\|wantRemoteControl\)[^\n]+hangupCall\(true/);
  assert.match(source, /else if\(wantRemoteControl\)setTimeout\([^\n]+remoteControlRequest/);
  assert.match(source, /\['\u901a\u8baf\u5f55','phoneContacts'\]/);
  assert.match(source, /target:'newFriendList'/);
  assert.match(source, /newFriendsOpenedAt=Date\.now\(\)/);
  assert.match(source, /尚未真实经过“通讯录 → 新的朋友”，不能执行拒绝/);
});

test("the role sees only visible pending requests and chooses instead of rejecting all", () => {
  const candidates = functionSource("remoteControlNewFriendRequests");
  const choice = functionSource("remoteControlNewFriendChoicePlan");
  assert.match(candidates, /r\.status==='pending'/);
  assert.match(candidates, /friendRequestVisible\(r\)/);
  assert.match(candidates, /r\.contactId!==actorId/);
  assert.match(choice, /只挑出你真正介意/);
  assert.match(choice, /不要为了展示功能而全选/);
  assert.match(choice, /没有想拒绝的就返回空数组/);
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
