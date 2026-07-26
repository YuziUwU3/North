import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../小手机.html", import.meta.url), "utf8");

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
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

function lineFunctionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  const end = source.indexOf("\nfunction ", start + 10);
  return source.slice(start, end < 0 ? source.length : end).trim();
}

assert.match(source, /APP_VER='v666 · 放映室横屏控制与陪伴修复'/);
assert.match(source, /cinema:\{e:'',c:'linear-gradient\([^\n]+t:'放映室',icon:'cinema',lk:1\}/);
assert.match(source, /cinema:\(\)=>openApp\('cinema'\)/);
assert.match(source, /cinema:\(\)=>\{cinemaInit\(\);go\('cinema'\);\}/);
assert.match(source, /cinemawatch:'cinema',cinemaread:'cinema'/);
assert.match(source, /else if\(c\.p==='cinemawatch'\)html=renderCinemaWatch\(\)/);
assert.match(source, /else if\(c\.p==='cinemaread'\)html=renderCinemaRead\(\)/);

assert.match(source, /video\/mp4,video\/webm,video\/quicktime/);
assert.match(source, /\.srt,\.vtt,text\/vtt/);
assert.match(source, /\.txt,\.md,\.epub/);
assert.match(source, /URL\.createObjectURL\(f\)/);
assert.doesNotMatch(source, /S\.cinema\.(?:videoFile|bookText)\s*=/);
assert.match(source, /cinemaOpenOnlineModal/);
assert.match(source, /cinemaOpenOnline\(\)[\s\S]*?https\?:/);
assert.match(source, /function cinemaRenameSave/);
assert.match(source, /function cinemaLibraryPlay/);
assert.doesNotMatch(functionSource("cinemaLibraryHTML"), /slice\(0,\s*12\)/, "video box and bookshelf must not hide older saved items");
assert.match(source, /从头开始/);
assert.match(source, /cinemaStoreKey\('video'/);
assert.match(source, /indexedDB\.open\('yibeiCinema',1\)/);
assert.match(source, /await cinPut\(key,f\)/);
assert.match(source, /scanIDBStoreBytes\(cinDB,'media'/);
assert.match(source, /视频盒/);
assert.match(source, /书架/);

const helperContext = vm.createContext({});
vm.runInContext(
  ["cinemaParseTime", "cinemaParseSubtitles", "cinemaPaginate"].map(lineFunctionSource).join("\n") +
  ";globalThis.parse=cinemaParseSubtitles;globalThis.paginate=cinemaPaginate;",
  helperContext,
);
const cues = helperContext.parse(`WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n第一句\n\n00:00:10.500 --> 00:00:12.000\n第二句`);
assert.equal(cues.length, 2);
assert.equal(cues[0].start, 1);
assert.equal(cues[1].start, 10.5);
assert.equal(cues[1].text, "第二句");
const pages = helperContext.paginate("第一段。".repeat(180) + "\n\n" + "第二段。".repeat(180), 500);
assert.ok(pages.length >= 3);
assert.ok(pages.every((page) => page.length <= 510));

const contextSandbox = vm.createContext({
  _cin: { cues: [
    { start: 5, end: 7, text: "过去" },
    { start: 18, end: 22, text: "当前" },
    { start: 19, end: 20, text: "语音转写", source: "speech" },
    { start: 30, end: 33, text: "未来剧透" },
  ] },
  cinemaFmt: (n) => String(n),
});
vm.runInContext(lineFunctionSource("cinemaSubtitleContext") + ";globalThis.ctx=cinemaSubtitleContext(20);", contextSandbox);
assert.match(contextSandbox.ctx, /过去/);
assert.match(contextSandbox.ctx, /当前/);
assert.doesNotMatch(contextSandbox.ctx, /语音转写/);
assert.doesNotMatch(contextSandbox.ctx, /未来剧透/);

assert.match(source, /严禁引用后面的剧情/);
assert.match(source, /不要动作描写、第三人称叙述、括号舞台说明、心情标签/);
assert.match(source, /没有可用字幕，只知道片名；不要假装知道具体剧情/);
assert.match(source, /当前屏幕字幕/);
assert.doesNotMatch(source, /播放时转写/);
assert.doesNotMatch(source, /function cinemaStartTranscribe/);
assert.doesNotMatch(source, /function cinemaToggleTranscribe/);
assert.match(source, /function cinemaExtractSubtitles/);
assert.match(source, /function cinemaExtractHelp/);
assert.match(source, /sttTranscribeTimed\(f/);
assert.match(source, /timestamp_granularities\[\]/);
assert.match(source, /接口没有返回分段时间戳/);
assert.match(source, /function cinemaAnalyzeFrame/);
assert.match(source, /visionAPI\(data/);
assert.match(source, /visionInterval/);
assert.match(source, /visionOnAsk/);
assert.match(source, /visionByRole/);
assert.match(source, /cinemaQuestionNeedsVision/);
assert.match(source, /识别中…/);
assert.match(source, /cinemaShowVoiceSubtitle\(spoken,translation\)/);
assert.match(source, /speak\(spoken,c\)/);
assert.match(source, /voiceLang:'role'/);
assert.match(source, /bookVoice:false/);
assert.match(source, /chatPanelHeight:104/);
assert.match(source, /readerPaneHeight:0/);
assert.match(source, /replyCount:1/);
assert.doesNotMatch(source, /bookInputHeight:108/);
assert.match(source, /function cinemaToggleBookVoice/);
assert.match(source, /s\.kind==='book'\?set\.bookVoice:set\.voiceComment/);
assert.match(source, /function cinemaComposerResizeStart/);
assert.match(source, /document\.addEventListener\('pointermove',move\)/);
assert.match(source, /function cinemaControlTap/);
assert.match(source, /root\.addEventListener\('pointerup',cinemaControlTap,true\)/);
assert.match(source, /root\.addEventListener\('touchend',cinemaControlTap/);
assert.match(source, /root\.addEventListener\('click',cinemaControlTap,true\)/);
assert.match(source, /class="cin-media-controls"/);
assert.match(source, /webkit-playsinline disablepictureinpicture/);
assert.doesNotMatch(source, /id="cinVideo"[^>]* controls/);
assert.match(source, /data-cin-resize="reader"/);
assert.doesNotMatch(source, /data-cin-resize="book"/);
assert.ok(source.indexOf('class="cin-reader-divider"') < source.indexOf('class="cin-reader-actions"'));
assert.match(source, /function cinemaReplyCountMenu/);
assert.match(source, /automatic\?1:cinemaReplyCount\(\)/);
assert.match(source, /!opt\.silentReply&&!_cin\.busy/);
assert.match(source, /addSummary\(c,memory,4,'【放映室】'\)/);
assert.match(source, /cinemaSessionId=s\.id/);
assert.match(source, /S\.cinema\.sessions=\(S\.cinema\.sessions\|\|\[\]\)\.filter\(x=>x&&x\.cid!==id\)/);
assert.match(source, /function cinemaSessionContext/);
assert.match(source, /function cinemaClearSessionContext/);
assert.match(source, /_cinemaSessionId/);
assert.match(source, /function cinemaRemoveWechatContext/);
assert.match(source, /function cinemaRenderKeepScroll/);
assert.match(source, /slice\(-\(cinemaContextRounds\(\)\*2\)\)/);
assert.match(source, /Object\.keys\(S\.messages\|\|\{\}\)/);
assert.match(source, /accountId:actId\(\)/);
assert.match(source, /msgsForAccount\(s\.cid,s\.accountId\|\|actId\(\)\)/);
assert.match(source, /function cinemaMirrorLifecycle/);
assert.match(source, /function cinemaInviteLibrary/);
assert.match(source, /type:'cinemainvite'/);
assert.match(source, /\[放映邀请\|/);
assert.match(source, /\[同意放映\]/);
assert.match(source, /\[拒绝放映\]/);

const behavior = vm.createContext({
  cinemaVoiceLang: () => "en",
  cleanReply: (value) => String(value || "").trim(),
  hasForeign: (value) => /[A-Za-z]/.test(value),
});
vm.runInContext(
  lineFunctionSource("cinemaQuestionNeedsVision") + "\n" +
  lineFunctionSource("cinemaOneSentence") + "\n" +
  lineFunctionSource("cinemaParseRolePayloads") + "\n" +
  lineFunctionSource("cinemaParseRolePayload") +
  ";globalThis.needsVision=cinemaQuestionNeedsVision;globalThis.parseRole=cinemaParseRolePayload;globalThis.parseRoles=cinemaParseRolePayloads;",
  behavior,
);
assert.equal(behavior.needsVision("画面里这个人是谁？"), true);
assert.equal(behavior.needsVision("我很喜欢这段音乐"), false);
const bilingual = behavior.parseRole("That was a beautiful scene.\n（这一幕很美。）", {});
assert.equal(bilingual.spoken, "That was a beautiful scene.");
assert.equal(bilingual.translation, "这一幕很美。");
assert.equal(bilingual.valid, true);
const oneSentence = behavior.parseRole("I love this part. I also know the ending.\n（我喜欢这里。后面我也知道。）", {});
assert.equal(oneSentence.spoken, "I love this part.");
assert.equal(oneSentence.translation, "我喜欢这里。");
const bilingualMany = behavior.parseRoles("I like this scene.\n（我喜欢这一幕。）\nThat was unexpected.\n（这一幕真意外。）", {}, 2);
assert.equal(bilingualMany.length, 2);
assert.equal(bilingualMany[1].spoken, "That was unexpected.");

const memoryState = {
  messages: {
    "role-a#account-a": [
      { id: "keep-a" },
      { id: "remove-a", _cinemaSessionId: "session-1" },
    ],
    "role-a#account-b": [
      { id: "remove-b", _cinemaSessionId: "session-1" },
      { id: "keep-b", _cinemaSessionId: "session-2" },
    ],
    __idb: "messages",
  },
};
const memoryBehavior = vm.createContext({ S: memoryState });
vm.runInContext(lineFunctionSource("cinemaRemoveWechatContext") + ";cinemaRemoveWechatContext('session-1');", memoryBehavior);
assert.deepEqual(memoryState.messages["role-a#account-a"].map((m) => m.id), ["keep-a"]);
assert.deepEqual(memoryState.messages["role-a#account-b"].map((m) => m.id), ["keep-b"]);

const watch = functionSource("renderCinemaWatch");
assert.match(watch, /cin-overlay-top/);
assert.match(watch, /cin-chat-dock/);
assert.match(watch, /data-cin-action="chat-open"/);
assert.match(watch, /data-cin-resize="video"/);
assert.match(watch, /--cin-chat-h:/);
assert.match(watch, /cinTopReveal/);
assert.match(watch, /data-cin-action="end"/);
assert.doesNotMatch(watch, /id="cinLog"/);
assert.doesNotMatch(watch, /cin-context/);
assert.doesNotMatch(watch, /event\.stopPropagation/);
assert.doesNotMatch(source, /把故事留在/);

const toolsHtmlContext = vm.createContext({
  _cin: { cues: [] },
  cinemaInit: () => ({ settings: { barrageFx: "cinema" } }),
  cinemaRole: () => ({}),
  cinemaReplyCount: () => 1,
  cinemaVoiceLangLabel: () => "中文",
  cinemaVisionIntervalLabel: () => "画面 按需",
  svgIc: () => "",
});
vm.runInContext(functionSource("cinemaStageTools") + ";globalThis.html=cinemaStageTools();", toolsHtmlContext);
assert.match(toolsHtmlContext.html, /data-cin-action="subtitle"/);
assert.match(toolsHtmlContext.html, /data-cin-action="extract"/);
assert.doesNotMatch(toolsHtmlContext.html, /data-cin-action="transcribe"/);
assert.match(toolsHtmlContext.html, /data-cin-action="frame"/);
assert.doesNotMatch(toolsHtmlContext.html, /event\.stopPropagation/);

let tappedAction = "", prevented = false, stopped = false;
const fakeControl = {
  disabled: false,
  dataset: { cinAction: "chat-open" },
  classList: { add() {}, remove() {} },
  isConnected: true,
};
const controlBehavior = vm.createContext({
  _cin: {},
  setTimeout: (fn) => fn(),
  cinemaChatToggle: (open) => { tappedAction = open ? "chat-open" : "chat-close"; },
  controlEvent: {
    target: { closest: () => fakeControl },
    preventDefault: () => { prevented = true; },
    stopPropagation: () => { stopped = true; },
  },
});
vm.runInContext(functionSource("cinemaEventPoint") + "\n" + functionSource("cinemaControlTap") + ";cinemaControlTap(controlEvent);", controlBehavior);
assert.equal(tappedAction, "chat-open");
assert.equal(prevented, true);
assert.equal(stopped, true);

const resizeListeners = {};
let resizedTo = 0, resizeSaved = 0;
const resizeBehavior = vm.createContext({
  $: () => ({ getBoundingClientRect: () => ({ height: 100 }) }),
  cinemaApplyComposerHeight: (height) => { resizedTo = height; },
  save: () => { resizeSaved++; },
  document: {
    addEventListener: (name, fn) => { resizeListeners[name] = fn; },
    removeEventListener: () => {},
  },
  resizeEvent: { clientY: 120, preventDefault() {} },
});
vm.runInContext(functionSource("cinemaComposerResizeStart") + ";cinemaComposerResizeStart(resizeEvent);", resizeBehavior);
resizeListeners.pointermove({ clientY: 70 });
assert.equal(resizedTo, 150);
resizeListeners.pointerup();
assert.equal(resizeSaved, 1);

const reader = functionSource("renderCinemaRead");
assert.match(reader, /id="cinBookVoiceBtn"/);
assert.match(reader, /data-cin-action="book-voice"/);
assert.match(reader, /data-cin-resize="reader"/);
assert.match(reader, /cinemaReaderPaneHeight\(\)/);
assert.doesNotMatch(reader, /data-cin-resize="book"/);

const contextRounds = vm.createContext({ S: { settings: { hist: 17 } } });
vm.runInContext(lineFunctionSource("cinemaContextRounds") + ";globalThis.rounds=cinemaContextRounds();", contextRounds);
assert.equal(contextRounds.rounds, 17);

const scrollBoxes = [{ scrollTop: 326 }, { scrollTop: 0 }];
let scrollRead = 0, renderCount = 0;
const scrollBehavior = vm.createContext({
  $: () => scrollBoxes[Math.min(scrollRead++, 1)],
  render: () => { renderCount++; },
  requestAnimationFrame: (fn) => fn(),
});
vm.runInContext(lineFunctionSource("cinemaRenderKeepScroll") + ";cinemaRenderKeepScroll();", scrollBehavior);
assert.equal(renderCount, 1);
assert.equal(scrollBoxes[1].scrollTop, 326);

assert.match(source, /cinema:_MI\(/);
assert.match(source, /HOMEAPPS=[\s\S]*?\['cinema','','放映室'\]/);
assert.match(source, /function setAppIcon\(key\)[\s\S]*?S\.me\.appIcons\[key\]=await compress/);
assert.match(html, /\.cin-barrage\{[^}]*background:transparent!important/);
assert.match(html, /\.cin-barrage\.mine\{color:#ff91bd/);
assert.match(html, /\.cin-barrage\.role\{color:#79caff/);
assert.match(html, /\.cin-stage,\.cin-stage\.cin-theater\{position:fixed;inset:0;z-index:9999/);
assert.match(html, /\.cin-overlay-top\.collapsed/);
assert.match(html, /\.cin-chat-dock\.open/);
assert.match(html, /\.cin-chat-grip/);
assert.match(html, /\.cin-theater-open \.modal\{position:fixed;z-index:10050\}/);
assert.match(html, /\.cin-theater-open \.toast\{position:fixed;z-index:10080\}/);
assert.match(html, /\.cin-chat-reveal\{left:auto;right:max\(14px,env\(safe-area-inset-right\)\);bottom:max\(62px/);
assert.match(html, /\.cin-reader-nav \.cin-reader-voice/);
assert.match(html, /--cin-chat-h/);
assert.match(html, /\.cin-voice-sub\.show/);
assert.match(html, /\.cin-invite-card/);
assert.match(html, /\.cin-memory-scroll/);
assert.match(html, /原创深色影院界面/);
assert.match(source, /function cinemaRoleOccupied/);
const occupiedState = { page: "cinemawatch", session: { cid: "role-a", status: "active" } };
const occupiedBehavior = vm.createContext({
  cur: () => ({ p: occupiedState.page }),
  cinemaSession: () => occupiedState.session,
});
vm.runInContext(lineFunctionSource("cinemaRoleOccupied") + ";globalThis.occupied=cinemaRoleOccupied;", occupiedBehavior);
assert.equal(occupiedBehavior.occupied("role-a"), true);
assert.equal(occupiedBehavior.occupied("role-b"), false);
occupiedState.page = "chat";
assert.equal(occupiedBehavior.occupied("role-a"), false);
assert.match(functionSource("scheduleReply"), /cinemaRoleOccupied\(id\)/);
assert.match(functionSource("incomingCall"), /cinemaRoleOccupied\(id\)/);
assert.match(functionSource("aiReply"), /cinemaRoleOccupied\(id\)/);
assert.match(functionSource("initiativeMaybeSend"), /cinemaRoleOccupied\(c\.id\)/);
assert.match(html, /app\.js\?v=666/);

console.log("cinema room tests passed");
