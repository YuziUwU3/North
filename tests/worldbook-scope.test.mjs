import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert.match(source, /const WORLD_SCOPE_OPTIONS=/);
assert.match(source, /允许这些软件吃世界书/);
assert.match(source, /function worldbookScopeOn\(scope\)/);
assert.match(source, /function toggleWorldScope\(k\)/);
assert.match(source, /worldbookPrompt\(recent,c\.id,'',opt\.worldbookScope\|\|'wechat'\)/);
assert.match(source, /worldbookPrompt\([\s\S]*?'线下约会','offline'\)/);
assert.match(source, /worldbookPromptForContacts\([\s\S]*?'角色扮演软件','roleplay'\)/);
assert.match(source, /worldbookPrompt\([\s\S]*?'小黑屋\/禁闭室','jail'\)/);
assert.match(source, /worldbookPrompt\([\s\S]*?'惊悚抉择','games'\)/);
assert.match(source, /worldbookPromptForContacts\([\s\S]*?'规则怪谈','games'\)/);
assert.match(source, /worldbookPromptForContacts\([\s\S]*?'马甲聊天','alter'\)/);

const start = source.indexOf("function worldHits(text,cid)");
const end = source.indexOf("function getSpy(c)", start);
assert.ok(start >= 0 && end > start);

const sandbox = {
  S: {
    settings: { worldbookApps: { offline: false } },
    worldbook: [
      { id: "global", enabled: true, always: true, name: "全局", content: "所有地方都知道" },
      { id: "c1", enabled: true, always: true, contacts: ["c1"], name: "角色一", content: "只给角色一" },
      { id: "kw", enabled: true, keys: "机场", name: "机场", content: "机场设定" },
      { id: "c2", enabled: true, keys: "机场", contacts: ["c2"], name: "角色二", content: "只给角色二" },
      { id: "off", enabled: false, always: true, name: "关闭", content: "不该出现" },
    ],
  },
  save() {
    sandbox.saved = true;
  },
  render() {
    sandbox.rendered = true;
  },
};

vm.runInNewContext(
  source.slice(start, end) +
    ";globalThis.hitC1=worldHits('机场', 'c1').map(x=>x.id);" +
    ";globalThis.hitNone=worldHits('机场', null).map(x=>x.id);" +
    ";globalThis.offlineText=worldbookPrompt('机场', 'c1', '线下约会', 'offline');" +
    ";globalThis.roleplayText=worldbookPrompt('机场', 'c1', '角色扮演', 'roleplay');" +
    ";toggleWorldScope('offline');globalThis.offlineOn=worldbookScopeOn('offline');",
  sandbox,
);

assert.deepEqual(Array.from(sandbox.hitC1), ["global", "c1", "kw"]);
assert.deepEqual(Array.from(sandbox.hitNone), ["global", "kw"]);
assert.equal(sandbox.offlineText, "");
assert.match(sandbox.roleplayText, /世界设定/);
assert.match(sandbox.roleplayText, /只给角色一/);
assert.equal(sandbox.offlineOn, true);
assert.equal(sandbox.saved, true);
assert.equal(sandbox.rendered, true);

console.log("worldbook scope tests passed");
