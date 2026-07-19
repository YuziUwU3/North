import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const sql = fs.readFileSync(path.join(root, "supabase_phone_friends_update_v584.sql"), "utf8");

assert.match(source, /const _pfCleanedMsgStores=typeof WeakSet/);
assert.match(source, /function pfReconcileReadInference\(\)[\s\S]*?latestBySender=new Map/);
assert.match(source, /function pfMessageIndex\(\)[\s\S]*?idx=new Map/);
assert.match(source, /function pfApplyReceipt\(r,idx\)/);
assert.match(source, /function pfApplyRecall\(r,idx\)/);
assert.match(source, /if\(p\.groupMessages\[gid\]\.some\(x=>x\.id===id\)\)return false;if\(from&&from!==p\.id\)pfInferGroupRead/);
assert.match(source, /function phoneFriendMaybeSync\(force\)[\s\S]*?document\.hidden/);
assert.match(source, /function pfMergeGroupsAuthoritative\(local,remote\)/);
assert.match(source, /p\.groups=pfMergeGroupsAuthoritative\(p\.groups,d&&d\.groups\)/);
assert.match(source, /oldGroupIds\.forEach\(gid=>\{if\(activeGroupIds\.has\(gid\)\)return;delete p\.groupMessages\[gid\]/);

assert.match(source, /function phoneFriendGroupMembers\(gid\)/);
assert.match(source, /成员昵称和头像来自群资料，即使没有互加好友也可以查看/);
assert.match(source, /function phoneFriendGroupRemoveMember\(gid,memberId\)/);
assert.match(source, /phone_friend_group_remove_member/);
assert.match(source, /const _pfGroupRenderLimit=\{\}/);
assert.match(source, /查看更早消息（还有 \$\{hidden\} 条）/);

assert.match(source, /function pfGroupMsgStoreKey\(\)/);
assert.match(source, /__idb:'phoneFriendGroupMessages'/);
assert.match(source, /p\.groupMessages&&p\.groupMessages\.__idb==='phoneFriendGroupMessages'/);

assert.match(sql, /create or replace function phone_friend_group_remove_member/);
assert.match(sql, /where id = p_group_id and owner_id = v_owner/);
assert.match(sql, /if v_member = v_owner then raise exception 'owner-cannot-remove-self'/);
assert.match(sql, /delete from phone_friend_group_members/);

const cleanStart = source.indexOf("const _pfCleanedMsgStores=");
const cleanEnd = source.indexOf("function phoneFriendState()", cleanStart);
assert.ok(cleanStart >= 0 && cleanEnd > cleanStart);
let ownKeyReads = 0;
const backing = { room: [{ id: "1" }, null] };
const store = new Proxy(backing, {
  ownKeys(target) {
    ownKeyReads += 1;
    return Reflect.ownKeys(target);
  },
});
const cleanSandbox = { store };
vm.runInNewContext(
  source.slice(cleanStart, cleanEnd) +
    ";globalThis.first=pfCleanMsgBuckets(store);globalThis.second=pfCleanMsgBuckets(store);",
  cleanSandbox,
);
assert.equal(cleanSandbox.first, true);
assert.equal(cleanSandbox.second, false);
assert.equal(ownKeyReads, 1, "the same message store should only be scanned once");
assert.equal(backing.room.length, 1);

const mergeStart = source.indexOf("function pfKeyOf(");
const mergeEnd = source.indexOf("function pfRemoteListStamp(", mergeStart);
assert.ok(mergeStart >= 0 && mergeEnd > mergeStart);
const mergeSandbox = {};
vm.runInNewContext(
  source.slice(mergeStart, mergeEnd) +
    ";globalThis.result=pfMergeGroupsAuthoritative([{group_id:'gone',local:1},{group_id:'keep',local:2}],[{group_id:'keep',name:'new'}]);",
  mergeSandbox,
);
assert.equal(mergeSandbox.result.length, 1);
assert.equal(mergeSandbox.result[0].group_id, "keep");
assert.equal(mergeSandbox.result[0].local, 2);
assert.equal(mergeSandbox.result[0].name, "new");

console.log("phone friend group performance tests passed");
