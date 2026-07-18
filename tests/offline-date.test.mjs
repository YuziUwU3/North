import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "\u5c0f\u624b\u673a.html"), "utf8");

assert.match(source, /v551 \u00b7 \u7ebf\u4e0b\u7ea6\u4f1a\u5b8c\u6574\u4e0a\u4e0b\u6587/);
assert.match(source, /function offlineRoleGuard\(c\)/);
assert.match(source, /function offlineRoleDrift\(t\)/);
assert.match(source, /for\(let _ra=0;_ra<2&&offlineRoleDrift\(r\)/);
assert.match(source, /m\.who==='\u65c1\u767d'&&m\.source==='me'/);
assert.match(source, /who:'\u65c1\u767d',source:'me',text:v/);

assert.match(source, /function offlineContextLimit\(\)/);
assert.match(source, /S\.settings&&S\.settings\.offHist/);
assert.match(source, /function offlineSharedContext\(c,limit\)/);
assert.match(source, /msgs\(c\.id\)\.map/);
assert.match(source, /callToCN\(raw\)\|\|raw/);
assert.match(source, /\.filter\(Boolean\)\.slice\(-limit\)/);
assert.match(source, /offlineSharedContext\(c,offlineContextLimit\(\)\)/);
assert.match(source, /const _on=offlineContextLimit\(\)/);

const helperStart = source.indexOf("function offlineContextLimit()");
const helperEnd = source.indexOf("function offlineLifeNotesPrompt", helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart);
const records = Array.from({ length: 45 }, (_, i) => ({
  role: i % 2 ? "assistant" : "user",
  type: "text",
  content: `message-${String(i).padStart(4, "0")}|`,
  time: 1000 + i,
  _call: i % 3 === 0,
  _ck: i % 6 === 0 ? "video" : "voice",
}));
const sandbox = {
  S: { settings: { offHist: 40 }, me: { name: "North" } },
  msgs: () => records,
  msgToText: (m) => m.content,
  callToCN: (text) => `CN(${text})`,
  fmtDT: (time) => `T${time}`,
};
vm.runInNewContext(
  source.slice(helperStart, helperEnd) +
    ";globalThis.limitResult=offlineContextLimit();" +
    "globalThis.contextResult=offlineSharedContext({id:'c1',name:'Role'},limitResult);",
  sandbox,
);
assert.equal(sandbox.limitResult, 40);
assert.match(sandbox.contextResult, /message-0005\|/);
assert.match(sandbox.contextResult, /message-0044\|/);
assert.doesNotMatch(sandbox.contextResult, /message-0004\|/);
assert.match(sandbox.contextResult, /\[视频通话\]/);
assert.match(sandbox.contextResult, /\[微信\]/);
assert.match(sandbox.contextResult, /\[North\]/);
assert.match(sandbox.contextResult, /\[Role\]/);

assert.match(source, /const remembered=memoryList\(c\)/);
assert.match(source, /remembered\.map/);
assert.match(source, /c\.summaries\.filter\(x=>x&&x\.text\)\.map/);
assert.doesNotMatch(source, /c\.summaries\.slice\(-10\)/);
assert.match(source, /o\.memory\.map\(offMemText\)/);
assert.doesNotMatch(source, /o\.memory\.slice\(-6\)/);
assert.match(source, /function offlineLifeNotesPrompt\(c\)/);
assert.match(source, /function offlineBehaviorLedgerPrompt\(c\)/);
assert.match(source, /s\+=dialogueEmotionPrompt\(c\)/);
assert.match(source, /s\+=memoryCriticalPrompt\(c\)/);

assert.match(source, /function offClearMemory\(id\)/);
assert.match(source, /o\.memory=\[\];o\.history=\[\];o\.previousEndedAt=0/);
assert.match(source, /x&&x\.offlineId/);
assert.match(source, /function offPreviousPrompt\(o\)/);
assert.match(source, /function renderOffIntro\(c,o\)/);

assert.match(source, /function offlineFocusActive\(\)/);
assert.match(source, /async function aiReply\(id,note,replyToken\)\{if\(offlineFocusActive\(\)\)return/);
assert.match(source, /function scheduleReply\(id,note\)\{\s*if\(offlineFocusActive\(\)\)return/);
assert.match(source, /function incomingCall\(id,kind\)\{if\(offlineFocusActive\(\)\)return/);
assert.match(source, /async function aiGroupReply\(id,fromText\)\{if\(offlineFocusActive\(\)\)return/);

assert.match(html, /\.offstage\{/);
assert.match(html, /\.offintro\{/);
assert.match(html, /\.offmsg\.them \.offbubble\{/);
assert.match(html, /\.offmsg\.me \.offbubble\{/);
assert.match(html, /app\.js\?v=551/);

console.log("offline date tests passed");
