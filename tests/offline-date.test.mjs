import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "\u5c0f\u624b\u673a.html"), "utf8");

assert.match(source, /v553 \u00b7 \u5267\u60c5\u5b57\u5e55\u4e0e\u5fae\u4fe1\u89e3\u9501/);
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
assert.match(source, /function offRevealTiming\(m\)/);
assert.match(source, /function offRevealText\(m\)/);
assert.match(source, /Object\.defineProperties\(item,\{_reveal:/);
assert.match(source, /setTimeout\(res,timing\.total\)/);
assert.match(source, /item\._reveal=false/);
assert.match(source, /!o\.msgs\.some\(m=>m\._reveal\)/);

const revealStart = source.indexOf("function offRevealTiming(m)");
const revealEnd = source.indexOf("function offlineSystem(c)", revealStart);
assert.ok(revealStart >= 0 && revealEnd > revealStart);
const revealSandbox = {
  matchMedia: () => ({ matches: false }),
  esc: (text) => String(text).replaceAll("<", "&lt;"),
};
vm.runInNewContext(
  source.slice(revealStart, revealEnd) +
    ";globalThis.narrTiming=offRevealTiming({who:'旁白',text:'一'.repeat(60)});" +
    "globalThis.talkTiming=offRevealTiming({who:'ta',text:'一'.repeat(60)});" +
    "globalThis.revealHtml=offRevealText({_reveal:true,_revealStep:42,text:'字幕渐显'});" +
    "globalThis.safeHtml=offRevealText({_reveal:false,text:'<b>'});",
  revealSandbox,
);
assert.equal(revealSandbox.narrTiming.step, 42);
assert.equal(revealSandbox.talkTiming.step, 30);
assert.ok(revealSandbox.narrTiming.total > revealSandbox.talkTiming.total);
assert.equal((revealSandbox.revealHtml.match(/class="offglyph"/g) || []).length, 4);
assert.match(revealSandbox.revealHtml, /animation-delay:0ms/);
assert.match(revealSandbox.revealHtml, /animation-delay:126ms/);
assert.equal(revealSandbox.safeHtml, "&lt;b>");

assert.match(source, /function offClearMemory\(id\)/);
assert.match(source, /o\.memory=\[\];o\.history=\[\];o\.previousEndedAt=0/);
assert.match(source, /x&&x\.offlineId/);
assert.match(source, /function offPreviousPrompt\(o\)/);
assert.match(source, /function renderOffIntro\(c,o\)/);

assert.match(source, /function offlineFocusActive\(\)/);
assert.match(source, /function offlineFocusStart\(id,o\)/);
assert.match(source, /function offlineFocusStop\(id\)/);
assert.doesNotMatch(source, /Object\.values\(S\.offline\|\|\{\}\)\.some\(o=>o&&o\.started\)/);
assert.match(source, /function enterJail\(cid,reason,test\)[\s\S]*?offlineFocusStop\(\)/);
assert.match(source, /function releaseJail\(backdoor\)[\s\S]*?offlineFocusStop\(\);save\(\)/);
assert.match(source, /async function aiReply\(id,note,replyToken\)\{if\(offlineFocusActive\(\)\)return/);
assert.match(source, /function scheduleReply\(id,note\)\{\s*if\(offlineFocusActive\(\)\)return/);
assert.match(source, /function incomingCall\(id,kind\)\{if\(offlineFocusActive\(\)\)return/);
assert.match(source, /async function aiGroupReply\(id,fromText\)\{if\(offlineFocusActive\(\)\)return/);

const focusStart = source.indexOf("function offlineFocusStart(id,o)");
const focusEnd = source.indexOf("const DAYPARTS", focusStart);
assert.ok(focusStart >= 0 && focusEnd > focusStart);
const focusSandbox = {
  S: {
    offline: { old: { started: true, session: "legacy", startedAt: 1000 } },
    offlineFocus: null,
  },
};
vm.runInNewContext(
  source.slice(focusStart, focusEnd) +
    ";globalThis.legacyLocked=offlineFocusActive();" +
    "offlineFocusStart('old',S.offline.old);" +
    "globalThis.liveLocked=offlineFocusActive();" +
    "S.offline.old.session='changed';" +
    "globalThis.changedLocked=offlineFocusActive();" +
    "globalThis.markerAfterChange=S.offlineFocus;",
  focusSandbox,
);
assert.equal(focusSandbox.legacyLocked, false);
assert.equal(focusSandbox.liveLocked, true);
assert.equal(focusSandbox.changedLocked, false);
assert.equal(focusSandbox.markerAfterChange, null);

assert.match(source, /const item=items\[i\],timing=offRevealTiming\(item\)/);
assert.match(source, /d\.msgs\.some\(m=>m\._reveal\)/);
assert.match(source, /who:'\u65c1\u767d',source:'me',text:v/);
assert.match(source, /m\.who==='\u65c1\u767d'&&m\.source==='me'/);
assert.match(source, /class="rpnar/);
assert.match(source, /class="bubble rpbubble"/);

assert.match(html, /\.offstage\{/);
assert.match(html, /\.offintro\{/);
assert.match(html, /\.offmsg\.them \.offbubble\{/);
assert.match(html, /\.offmsg\.me \.offbubble\{/);
assert.match(html, /\.offreveal \.offglyph/);
assert.match(html, /@keyframes offglyph/);
assert.doesNotMatch(html, /\.offnar,\.offmsg\{animation:offfade/);
assert.match(html, /\.rpstage\{/);
assert.match(html, /\.rpnar\{/);
assert.match(html, /\.rpmsg\.them \.rpbubble\{/);
assert.match(html, /\.rpmsg\.me \.rpbubble\{/);
assert.match(html, /app\.js\?v=553/);

console.log("offline date tests passed");
