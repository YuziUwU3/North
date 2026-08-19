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
  functionSource("chatDateStampHTML"),
  functionSource("chatBoundaryHTML"),
  functionSource("chatHistoryDateNote"),
  functionSource("chatHistoryWithDateBoundaries")
].join("\n");

const ctx = {
  console,
  Date,
  roleTimeParts: t => {
    const d = new Date(t || Date.now());
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  },
  esc: s => String(s),
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
const boundary = ctx.chatBoundaryHTML({ time: a }, { time: b });
assert.match(boundary, /datestamp/);
assert.match(boundary, /7.*25.*00:05/);
assert.equal((boundary.match(/<div/g) || []).length, 1, "cross-day date and time should be one visible divider");
const sameDayGap = ctx.chatBoundaryHTML({ time: b }, { time: b + 6 * 60 * 1000 });
assert.doesNotMatch(sameDayGap, /datestamp/);
assert.match(sameDayGap, /00:11/);
const hist = ctx.chatHistoryWithDateBoundaries([
  { role: "user", content: "昨天的话", time: a },
  { role: "assistant", content: "今天的话", time: b }
]);
assert.equal(hist.filter(x => x.role === "system").length, 2);
assert.match(hist[0].content, /日期分隔/);
assert.match(hist[0].content, /角色必须据此分清今天、昨天、前几天和新的一天/);

assert.match(source, /function chatBoundaryHTML\(prev,m\)/);
assert.match(source, /function appendChatMessageHTML\(id,c,m,opt\)/);
assert.match(source, /function renderGroup\(id\)[\s\S]*chatBoundaryHTML\(/);
assert.match(source, /renderPhoneFriendChat[\s\S]*chatBoundaryHTML\(prev,m\)/);
assert.match(source, /renderPhoneFriendGroup[\s\S]*chatBoundaryHTML\(prev,m\)/);
assert.match(source, /function chatMessageListHTML\(id,c\)[\s\S]*let prevVisible=null/);
assert.match(source, /function renderChat\(id\)[\s\S]*chatMessageListHTML\(id,c\)/);
assert.match(source, /function pfSpyLine\(m,peer\)[\s\S]*factStamp/);
assert.match(source, /function remoteControlHistoryPrompt\(c\)[\s\S]*factStamp/);
assert.match(source, /function remoteControlWechatCandidates\(c\)[\s\S]*factStamp/);
assert.match(source, /function callSpyRecentPrompt\(id\)[\s\S]*factStamp/);

console.log("chat date boundary tests passed");
