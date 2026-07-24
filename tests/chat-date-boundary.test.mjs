import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");

function functionSource(name) {
  const start = source.indexOf(`function ${name}`);
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

const code = [
  functionSource("ymd"),
  functionSource("ymdFull"),
  functionSource("fmtDT"),
  functionSource("dayStartMs"),
  functionSource("dayGap"),
  functionSource("dayKey"),
  functionSource("dayRelText"),
  functionSource("factStamp"),
  functionSource("chatDateLabel"),
  functionSource("chatHistoryDateNote"),
  functionSource("chatHistoryWithDateBoundaries")
].join("\n");

const ctx = {
  console,
  Date,
  hm: t => new Date(t || Date.now()).getHours().toString().padStart(2, "0") + ":" + new Date(t || Date.now()).getMinutes().toString().padStart(2, "0"),
  weekdayCN: t => "周测",
  msgToText: m => m.content || ""
};
vm.createContext(ctx);
vm.runInContext(code, ctx);

const lastYear = new Date(new Date().getFullYear() - 1, 11, 31, 23, 59).getTime();
assert.match(ctx.chatDateLabel(lastYear), /\d{4}年12月31日/);
assert.match(ctx.factStamp(lastYear), /\d{4}年12月31日 .*（\d+天前）/);

const a = new Date(2026, 6, 24, 23, 55).getTime();
const b = new Date(2026, 6, 25, 0, 5).getTime();
const hist = ctx.chatHistoryWithDateBoundaries([
  { role: "user", content: "昨天的话", time: a },
  { role: "assistant", content: "今天的话", time: b }
]);
assert.equal(hist.filter(x => x.role === "system").length, 2);
assert.match(hist[0].content, /日期分隔/);
assert.match(hist[0].content, /角色必须据此分清今天、昨天、前几天和新的一天/);

assert.match(source, /function chatBoundaryHTML\(prev,m\)/);
assert.match(source, /function appendChatMessageHTML\(id,c,m,opt\)/);
assert.match(source, /renderPhoneFriendChat[\s\S]*chatBoundaryHTML\(prev,m\)/);
assert.match(source, /renderPhoneFriendGroup[\s\S]*chatBoundaryHTML\(prev,m\)/);
assert.match(source, /function pfSpyLine\(m,peer\)[\s\S]*factStamp/);
assert.match(source, /function remoteControlHistoryPrompt\(c\)[\s\S]*factStamp/);
assert.match(source, /function remoteControlWechatCandidates\(c\)[\s\S]*factStamp/);
assert.match(source, /function callSpyRecentPrompt\(id\)[\s\S]*factStamp/);

console.log("chat date boundary tests passed");
