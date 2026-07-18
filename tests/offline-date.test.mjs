import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "\u5c0f\u624b\u673a.html"), "utf8");

assert.match(source, /v561 \u00b7 \u7ea6\u4f1a\u6309\u8f6e\u56de\u5e94/);
assert.match(source, /function offlineRoleGuard\(c\)/);
assert.match(source, /function offlineRoleDrift\(t\)/);
assert.match(source, /for\(let _ra=0;_ra<2&&offlineRoleDrift\(r\)/);
assert.match(source, /m\.who==='\u65c1\u767d'&&m\.source==='me'/);
assert.match(source, /who:'\u65c1\u767d',source:'me',text:v/);

assert.match(source, /function offlineContextLimit\(\)/);
assert.match(source, /S\.settings&&S\.settings\.offHist/);
assert.match(source, /function offlineCurrentTurnPrompt\(o,note\)/);
assert.match(source, /function offlineHistoryMessages\(o,limit,opt\)/);
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

const historyStart = source.indexOf("function offlineIsUserMsg(m)");
const historyEnd = source.indexOf("function offlineSharedContext", historyStart);
assert.ok(historyStart >= 0 && historyEnd > historyStart);
const historySandbox = {};
vm.runInNewContext(
  source.slice(historyStart, historyEnd) +
    ";const date={msgs:[" +
    "{who:'me',text:'u1'},{who:'\\u65c1\\u767d',source:'ta',text:'n1'},{who:'ta',text:'a1'}," +
    "{who:'me',text:'u2'},{who:'\\u65c1\\u767d',source:'ta',text:'n2'},{who:'ta',text:'a2'},{who:'ta',text:'a2b'}," +
    "{who:'me',text:'u3'},{who:'\\u65c1\\u767d',source:'ta',text:'n3'},{who:'ta',text:'a3'}" +
    "]};globalThis.rounds=offlineHistoryMessages(date,2);",
  historySandbox,
);
assert.deepEqual(
  Array.from(historySandbox.rounds, (x) => ({ role: x.role, content: x.content })),
  [
    { role: "user", content: "u2" },
    { role: "assistant", content: "\u3010n2\u3011\na2\na2b" },
    { role: "user", content: "u3" },
    { role: "assistant", content: "\u3010n3\u3011\na3" },
  ],
);
const currentTurnSandbox = { S: { me: { name: "\u5fc6\u5317" } } };
vm.runInNewContext(
  source.slice(historyStart, historyEnd) +
    ";const date={msgs:[" +
    "{who:'ta',text:'\\u770b\\u7740\\u4f60'}," +
    "{who:'me',text:'\\u597d\\u770b\\u5417\\uff1f'}," +
    "{who:'me',text:'\\u7136\\u540e\\u5462\\uff1f\\u6ca1\\u4e86\\uff1f'}" +
    "]};globalThis.deferred=offlineHistoryMessages(date,4,{deferCurrent:true});" +
    "globalThis.focus=offlineCurrentTurnPrompt(date);",
  currentTurnSandbox,
);
assert.deepEqual(Array.from(currentTurnSandbox.deferred, (x) => ({ role: x.role, content: x.content })), [
  { role: "assistant", content: "\u770b\u7740\u4f60" },
]);
assert.match(currentTurnSandbox.focus, /\u597d\u770b\u5417/);
assert.match(currentTurnSandbox.focus, /\u7136\u540e\u5462/);
assert.match(currentTurnSandbox.focus, /\u540c\u4e00\u8f6e\u5f85\u56de\u5e94/);
assert.match(currentTurnSandbox.focus, /\u4e00\u6b21\u6027\u6309\u987a\u5e8f\u90fd\u63a5\u4f4f/);

const repeatStart = source.indexOf("const OFFLINE_ROUTINE_TOPICS=");
const repeatEnd = source.indexOf("function offlineSystem(c)", repeatStart);
assert.ok(repeatStart >= 0 && repeatEnd > repeatStart);
const repeatSandbox = {
  splitBubbles: (text) => String(text).split(/\n+/).filter(Boolean),
  splitActions: (text) => [text],
};
vm.runInNewContext(
  source.slice(repeatStart, repeatEnd) +
    ";const date={msgs:[" +
    "{who:'ta',text:'\\u6211\\u7ed9\\u4f60\\u7684\\u4efb\\u52a1\\u505a\\u5b8c\\u4e86\\u5417\\uff1f'}," +
    "{who:'ta',text:'\\u665a\\u996d\\u5403\\u8fc7\\u6ca1\\u6709\\uff1f'}" +
    "]};" +
    "globalThis.taskRepeat=offlineRepeatFails('\\u4eca\\u5929\\u8be5\\u505a\\u7684\\u90fd\\u5b8c\\u6210\\u6ca1\\u6709\\uff1f',date,'\\u6211\\u4eec\\u53bb\\u770b\\u7535\\u5f71\\u5427');" +
    "globalThis.mealRepeat=offlineRepeatFails('\\u4f60\\u4eca\\u5929\\u5403\\u996d\\u4e86\\u5417\\uff1f',date,'\\u4eca\\u665a\\u7684\\u706f\\u5149\\u5f88\\u597d\\u770b');" +
    "globalThis.userRaisedTask=offlineRepeatFails('\\u4efb\\u52a1\\u5df2\\u7ecf\\u505a\\u5b8c\\u4e86',date,'\\u6211\\u7684\\u4efb\\u52a1\\u505a\\u5b8c\\u4e86');" +
    "globalThis.freshScene=offlineRepeatFails('\\u6211\\u4eec\\u5750\\u5230\\u7a97\\u8fb9\\u53bb\\u5427',date,'\\u6211\\u4eec\\u53bb\\u770b\\u7535\\u5f71\\u5427');" +
    "globalThis.sameTurn=offlineRepeatFails('\\u3010\\u4ed6\\u62c9\\u5f00\\u4e86\\u6905\\u5b50\\u3011\\n\\u5750\\u8fd9\\u91cc\\u5427\\n\\u3010\\u4ed6\\u62c9\\u5f00\\u4e86\\u6905\\u5b50\\u3011\\n\\u5750\\u8fd9\\u91cc\\u5427',{msgs:[]},'\\u6211\\u4eec\\u8fdb\\u53bb\\u5427');" +
    "const oldTurn={msgs:[{who:'\\u65c1\\u767d',source:'ta',text:'\\u4ed6\\u653e\\u4e0b\\u884c\\u674e\\u7bb1\\uff0c\\u4f38\\u624b\\u63c9\\u4e86\\u63c9\\u5979\\u7684\\u5934\\u53d1'},{who:'ta',text:'\\u4e8c\\u5341\\u5929\\u6ca1\\u89c1'},{who:'\\u65c1\\u767d',source:'ta',text:'\\u4ed6\\u7684\\u58f0\\u97f3\\u538b\\u5f97\\u5f88\\u4f4e\\uff0c\\u62c7\\u6307\\u8f7b\\u8f7b\\u64e6\\u8fc7\\u5979\\u7684\\u8138\\u988a'},{who:'ta',text:'\\u7626\\u4e86'}]};" +
    "globalThis.crossTurn=offlineRepeatFails('\\u3010\\u4ed6\\u653e\\u4e0b\\u884c\\u674e\\u7bb1\\uff0c\\u4f38\\u624b\\u63c9\\u4e86\\u63c9\\u5979\\u7684\\u5934\\u53d1\\u3011\\n\\u4e8c\\u5341\\u5929\\u6ca1\\u89c1',oldTurn,'\\u597d\\u770b\\u5417');" +
    "globalThis.deduped=offDedupeItems([" +
    "{who:'\\u65c1\\u767d',text:'\\u4ed6\\u62c9\\u5f00\\u4e86\\u6905\\u5b50'}," +
    "{who:'ta',text:'\\u5750\\u8fd9\\u91cc\\u5427'}," +
    "{who:'\\u65c1\\u767d',text:'\\u4ed6\\u62c9\\u5f00\\u4e86\\u6905\\u5b50'}," +
    "{who:'ta',text:'\\u5750\\u8fd9\\u91cc\\u5427'}],{msgs:[]},'');" +
    "globalThis.crossDeduped=offDedupeItems([" +
    "{who:'\\u65c1\\u767d',text:'\\u4ed6\\u653e\\u4e0b\\u884c\\u674e\\u7bb1\\uff0c\\u4f38\\u624b\\u63c9\\u4e86\\u63c9\\u5979\\u7684\\u5934\\u53d1'}," +
    "{who:'ta',text:'\\u4e8c\\u5341\\u5929\\u6ca1\\u89c1'}," +
    "{who:'\\u65c1\\u767d',text:'\\u4ed6\\u7684\\u58f0\\u97f3\\u538b\\u5f97\\u5f88\\u4f4e\\uff0c\\u62c7\\u6307\\u8f7b\\u8f7b\\u64e6\\u8fc7\\u5979\\u7684\\u8138\\u988a'}," +
    "{who:'ta',text:'\\u7626\\u4e86'}," +
    "{who:'ta',text:'\\u597d\\u770b'}],oldTurn,'\\u597d\\u770b\\u5417');",
  repeatSandbox,
);
assert.ok(Array.from(repeatSandbox.taskRepeat).some((x) => x.includes("\u4efb\u52a1")));
assert.ok(Array.from(repeatSandbox.mealRepeat).some((x) => x.includes("\u5403\u996d")));
assert.deepEqual(Array.from(repeatSandbox.userRaisedTask), []);
assert.deepEqual(Array.from(repeatSandbox.freshScene), []);
assert.ok(Array.from(repeatSandbox.sameTurn).some((x) => x.includes("\u540c\u4e00\u8f6e")));
assert.ok(Array.from(repeatSandbox.crossTurn).some((x) => x.includes("\u524d\u51e0\u8f6e")));
assert.equal(Array.from(repeatSandbox.deduped).length, 2);
assert.deepEqual(Array.from(repeatSandbox.crossDeduped, (x) => x.text), ["\u597d\u770b"]);
assert.match(source, /# \u672c\u573a\u8fde\u7eed\u6027\u4e0e\u9632\u590d\u8bfb\uff08\u53ea\u7ea6\u675f\u7ebf\u4e0b\u7ea6\u4f1a\uff09/);
assert.match(source, /const _on=offlineContextLimit\(\),hist=offlineHistoryMessages\(o,_on,\{deferCurrent:true\}\),turn=offlineCurrentTurnPrompt\(o,note\)/);
assert.match(source, /offlineRepeatRepairNote\(c,check\)/);

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
assert.match(source, /function offlineRepairState\(\)/);
assert.match(source, /function offlineDeactivate\(id,o,clearMsgs\)/);
assert.match(source, /function offlineCanResume\(o\)/);
assert.match(source, /function offlineResume\(id,o\)/);
assert.match(source, /function offlinePickTap\(ev,cid\)/);
assert.match(source, /ontouchend="offlinePickTap\(event,'\$\{c\.id\}'\)"/);
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
    offline: {
      old: { started: true, session: "legacy", startedAt: 1000 },
      stale: { started: true, session: "", startedAt: 0, endedAt: 2000, msgs: [{ text: "old" }] },
      recoverable: { started: false, session: "", startedAt: 0, endedAt: 2000, msgs: [{ text: "kept" }] },
    },
    offlineFocus: null,
  },
  _off: null,
  saveCount: 0,
  save() {
    focusSandbox.saveCount += 1;
  },
  uid() {
    return "migrated-session";
  },
};
vm.runInNewContext(
  source.slice(focusStart, focusEnd) +
    ";globalThis.legacyLocked=offlineFocusActive();" +
    "globalThis.staleMigrated={started:S.offline.stale.started,session:S.offline.stale.session,startedAt:S.offline.stale.startedAt};" +
    "globalThis.recoverable=offlineCanResume(S.offline.recoverable);" +
    "offlineFocusStart('old',S.offline.old);" +
    "globalThis.liveLocked=offlineFocusActive();" +
    "S.offline.old.session='changed';" +
    "globalThis.changedLocked=offlineFocusActive();" +
    "globalThis.markerAfterChange=S.offlineFocus;",
  focusSandbox,
);
assert.equal(focusSandbox.legacyLocked, false);
assert.deepEqual({ ...focusSandbox.staleMigrated }, { started: true, session: "migrated-session", startedAt: 2000 });
assert.equal(focusSandbox.recoverable, true);
assert.equal(focusSandbox.liveLocked, true);
assert.equal(focusSandbox.changedLocked, true);
assert.equal(focusSandbox.markerAfterChange.session, "changed");
assert.ok(focusSandbox.saveCount >= 1);

const offEndStart = source.indexOf("async function offEnd(id)");
const offEndEnd = source.indexOf("function offSetting", offEndStart);
assert.ok(offEndStart >= 0 && offEndEnd > offEndStart);
const offEndSource = source.slice(offEndStart, offEndEnd);
assert.ok(offEndSource.indexOf("offlineDeactivate(id,o,true)") < offEndSource.indexOf("chatAPI("));
assert.match(offEndSource, /const ended=\{session:/);
assert.match(offEndSource, /msgs:ended\.msgs/);
assert.doesNotMatch(offEndSource, /o\.started=false;o\.session='';o\.startedAt=0;o\.msgs=\[\]/);
assert.match(source, /function tvStartDate\(tid\)[\s\S]*?offBeginSession\(trip\.cid,o,trip\.to,trip\.date,dayPartNow\(\)\)/);
assert.match(source, /who:'\u65c1\u767d',source:'me',text:'\uff08'\+tvMD\(trip\.date\)/);

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
assert.match(html, /app\.js\?v=561/);

console.log("offline date tests passed");
