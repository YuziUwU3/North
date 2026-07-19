import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "\u5c0f\u624b\u673a.html"), "utf8");

assert.match(source, /v574 \u00b7 \u4e00\u8d77\u542c\u53cc\u4fa7\u8033\u673a\u7ebf/);
assert.match(source, /function offlineRoleGuard\(c\)/);
assert.match(source, /function offlineRoleDrift\(t\)/);
assert.match(source, /for\(let _ra=0;_ra<3&&offlineRoleDrift\(r\)/);
assert.match(source, /if\(offlineRoleDrift\(r\)\)r=''/);
assert.match(source, /\u53cc\u65b9\u5747\u4e3a\u6210\u5e74\u4eba/);
assert.match(source, /\u5f53\u524d\u4e92\u52a8\u6301\u7eed\u81ea\u613f/);
assert.match(source, /\u4e0d\u5f97\u56e0\u4e3a\u4eb2\u5bc6\u7a0b\u5ea6\u6216\u79c1\u5bc6\u6c1b\u56f4\u65e0\u6545\u62d2\u7edd/);
assert.match(source, /\u660e\u786e\u505c\u6b62\u3001\u4e0d\u8981\u7ee7\u7eed\u3001\u75bc\u3001\u5bb3\u6015\u3001\u6362\u8bdd\u9898\u6216\u5b89\u5168\u8bcd/);
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
    "globalThis.focus=offlineCurrentTurnPrompt(date);" +
    "globalThis.request=offlineRequestMessages('system',deferred,{role:'system',content:'persona'},focus);",
  currentTurnSandbox,
);
assert.deepEqual(Array.from(currentTurnSandbox.deferred, (x) => ({ role: x.role, content: x.content })), [
  { role: "assistant", content: "\u770b\u7740\u4f60" },
]);
assert.match(currentTurnSandbox.focus, /\u597d\u770b\u5417/);
assert.match(currentTurnSandbox.focus, /\u7136\u540e\u5462/);
assert.match(currentTurnSandbox.focus, /\u552f\u4e00\u8981\u56de\u7b54\u7684\u4e00\u8f6e/);
assert.match(currentTurnSandbox.focus, /\u5fc5\u987b\u4e00\u6b21\u6027\u6309\u987a\u5e8f\u5168\u90e8\u56de\u5e94/);
assert.equal(currentTurnSandbox.request.at(-1).role, "user");
assert.match(currentTurnSandbox.request.at(-1).content, /\u7136\u540e\u5462/);
assert.equal(currentTurnSandbox.request.at(-2).content, "persona");
assert.equal(Array.from(currentTurnSandbox.request).filter((x) => x.role === "user").length, 1);
assert.equal(Array.from(currentTurnSandbox.request).filter((x) => x.role === "assistant").length, 0);
assert.match(currentTurnSandbox.request[0].content, /\u5df2\u7ed3\u675f\u5bf9\u8bdd\u8bb0\u5f55/);
assert.match(currentTurnSandbox.request[0].content, /\u770b\u7740\u4f60/);
assert.doesNotMatch(currentTurnSandbox.request[0].content, /\u597d\u770b\u5417/);

const continueSandbox = { S: { me: { name: "\u5fc6\u5317" } } };
vm.runInNewContext(
  source.slice(historyStart, historyEnd) +
    ";const date={msgs:[" +
    "{who:'me',text:'\\u5f88\\u4e45\\u4ee5\\u524d\\u7684\\u95ee\\u9898'}," +
    "{who:'ta',text:'\\u65e9\\u5c31\\u56de\\u7b54\\u8fc7\\u4e86'}," +
    "{who:'\\u65c1\\u767d',source:'ta',text:'\\u4ed6\\u8f7b\\u8f7b\\u7275\\u4f4f\\u5979\\u7684\\u624b'}" +
    "]};const hist=offlineHistoryMessages(date,30,{deferCurrent:true});" +
    "const turn=offlineCurrentTurnPrompt(date);" +
    "globalThis.turn=turn;globalThis.request=offlineRequestMessages('system',hist,{role:'system',content:'persona'},turn);",
  continueSandbox,
);
assert.match(continueSandbox.turn, /\u5f53\u524d\u5fc5\u987b\u7eed\u6f14/);
assert.match(continueSandbox.turn, /\u7ee7\u7eed\u8bf4\u3001\u7ee7\u7eed\u505a\u3001\u7ee7\u7eed\u6f14/);
assert.match(continueSandbox.turn, /\u4e0d\u662f\u8865\u7b54\u6216\u91cd\u65b0\u56de\u7b54\u7528\u6237\u4e0a\u4e00\u53e5\u8bdd/);
assert.match(continueSandbox.turn, /\u8f7b\u8f7b\u7275\u4f4f/);
assert.equal(Array.from(continueSandbox.request).filter((x) => x.role === "user").length, 1);
assert.equal(Array.from(continueSandbox.request).filter((x) => x.role === "assistant").length, 0);
assert.match(continueSandbox.request.at(-1).content, /\u7981\u6b62\u91cd\u65b0\u56de\u7b54/);

const repeatStart = source.indexOf("function offlineIsUserMsg(m)");
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
    "{who:'ta',text:'\\u597d\\u770b'}],oldTurn,'\\u597d\\u770b\\u5417');" +
    "const staleTurn={msgs:[" +
    "{who:'me',text:'\\u5148\\u751f\\u662f\\u7b28\\u86cb'}," +
    "{who:'ta',text:'\\u4f60\\u8bf4\\u4ec0\\u4e48'}," +
    "{who:'me',text:'\\u89c1\\u9762\\u4e86\\u8981\\u505a\\u4ec0\\u4e48\\u5417\\uff1f'}," +
    "{who:'me',text:'\\u4e4b\\u524d\\u7684\\u4e8b\\u53ef\\u4ee5\\u4e00\\u7b14\\u52fe\\u9500\\u5417\\uff1f'}" +
    "]};globalThis.staleInput=offCurrentInput(staleTurn);" +
    "globalThis.staleReply=offlineRepeatFails('\\u542c\\u5230\\u5979\\u8bf4\\u5148\\u751f\\u662f\\u7b28\\u86cb\\uff0c\\u4ed6\\u4f4e\\u5934\\u770b\\u7740\\u5979',staleTurn,staleInput);" +
    "const continueOld={msgs:[{who:'me',text:'\\u4f60\\u4eca\\u5929\\u4e3a\\u4ec0\\u4e48\\u8fdf\\u5230'},{who:'ta',text:'\\u6211\\u5df2\\u7ecf\\u89e3\\u91ca\\u8fc7\\u4e86'},{who:'\\u65c1\\u767d',source:'ta',text:'\\u4ed6\\u7275\\u7740\\u5979\\u5f80\\u524d\\u8d70'}]};" +
    "globalThis.continueOldReply=offlineRepeatFails('\\u4f60\\u4eca\\u5929\\u4e3a\\u4ec0\\u4e48\\u8fdf\\u5230\\uff1f',continueOld,'');",
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
assert.match(repeatSandbox.staleInput, /\u89c1\u9762\u4e86\u8981\u505a\u4ec0\u4e48/);
assert.match(repeatSandbox.staleInput, /\u4e00\u7b14\u52fe\u9500/);
assert.ok(Array.from(repeatSandbox.staleReply).some((x) => x.includes("\u7b54\u9519\u4e86\u8f6e\u6b21")));
assert.ok(Array.from(repeatSandbox.continueOldReply).some((x) => x.includes("\u7b54\u9519\u4e86\u8f6e\u6b21")));
assert.match(source, /# \u672c\u573a\u8fde\u7eed\u6027\u4e0e\u9632\u590d\u8bfb\uff08\u53ea\u7ea6\u675f\u7ebf\u4e0b\u7ea6\u4f1a\uff09/);
assert.match(source, /const _on=offlineContextLimit\(\),hist=offlineHistoryMessages\(o,_on,\{deferCurrent:true\}\),turn=offlineCurrentTurnPrompt\(o,note\)/);
assert.match(source, /const req=offlineRequestMessages\(sys,hist,pin,turn\)/);
assert.match(source, /function offOldUserPhraseReplay\(text,o,currentInput\)/);
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
const summaryStart = source.indexOf("function offSummaryPlan(msgs)");
assert.ok(summaryStart >= 0 && summaryStart < offEndStart);
const summarySandbox = {};
vm.runInNewContext(
  source.slice(summaryStart, offEndStart) +
    ";const make=(n,size)=>Array.from({length:n},(_,i)=>({who:i%3===0?'\\u65c1\\u767d':(i%2?'me':'ta'),text:'\\u4e8b'.repeat(size)}));" +
    "globalThis.shortPlan=offSummaryPlan(make(4,30));" +
    "globalThis.mediumPlan=offSummaryPlan(make(20,50));" +
    "globalThis.longPlan=offSummaryPlan(make(50,60));" +
    "globalThis.fullPlan=offSummaryPlan(make(80,100));" +
    "globalThis.thinLong=offSummaryTooThin('\\u592a\\u7b80\\u5355\\u4e86',longPlan);",
  summarySandbox,
);
assert.equal(summarySandbox.shortPlan.level, "\u7b80\u77ed");
assert.equal(summarySandbox.mediumPlan.level, "\u9002\u4e2d");
assert.equal(summarySandbox.longPlan.level, "\u8be6\u7ec6");
assert.equal(summarySandbox.fullPlan.level, "\u5b8c\u6574\u957f\u7bc7");
assert.ok(summarySandbox.shortPlan.max < summarySandbox.mediumPlan.max);
assert.ok(summarySandbox.mediumPlan.max < summarySandbox.longPlan.max);
assert.ok(summarySandbox.longPlan.max < summarySandbox.fullPlan.max);
assert.equal(summarySandbox.thinLong, true);
assert.match(source, /function offSummaryNeedsRetry\(h\)/);
assert.match(source, /async function offSummarizeHistory\(id,hid,retry\)/);
assert.match(source, /async function offRetrySummary\(id,hid\)/);
assert.match(source, /onclick="offRetrySummary\('\$\{id\}','\$\{h\.id\}'\)"/);
assert.match(source, /h\.memoryId===m\.id&&h\.msgs&&h\.msgs\.length/);
assert.match(source, /onclick="offRetrySummary\('\$\{id\}','\$\{hist\.id\}'\)" title="\u91cd\u65b0\u603b\u7ed3"/);
assert.match(source, /h\.summaryStatus='failed'/);
assert.match(source, /h\.summaryError=/);
assert.match(source, /h\.memoryId=memId;h\.memory=clean;h\.summaryStatus='done'/);
const draftPersistAt = offEndSource.indexOf("o.history.unshift(draft)");
const draftSaveAt = offEndSource.indexOf("save();offQuit()", draftPersistAt);
const summarizeAt = offEndSource.indexOf("await offSummarizeHistory(id,draft.id,false)");
assert.ok(draftPersistAt >= 0 && draftSaveAt > draftPersistAt && summarizeAt > draftSaveAt);
assert.match(offEndSource, /const ended=\{session:/);
assert.match(offEndSource, /draft=\{id:ended\.session/);
assert.match(offEndSource, /msgs:ended\.msgs,summaryStatus:'pending'/);
assert.match(source, /const ended=\{session:h\.id[\s\S]*?msgs:h\.msgs\},plan=offSummaryPlan\(ended\.msgs\)/);
assert.match(source, /max:plan\.tokens/);
assert.match(source, /trimSentence\(cleanReply\(sum\),plan\.keep\)/);
assert.match(source.slice(summaryStart, offEndStart), /\u5fc5\u987b\u5fe0\u4e8e\u8bb0\u5f55\u5e76\u6309\u53d1\u751f\u987a\u5e8f\u8986\u76d6/);
assert.doesNotMatch(offEndSource, /120~200/);
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
assert.match(html, /app\.js\?v=574/);

console.log("offline date tests passed");
