import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../小手机.html", import.meta.url), "utf8");

function functionSource(name) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `missing ${name}`);
  const next = source.indexOf("\nfunction ", start + 9);
  const nextAsync = source.indexOf("\nasync function ", start + 9);
  const ends = [next, nextAsync].filter((x) => x >= 0);
  return source.slice(start, ends.length ? Math.min(...ends) : source.length);
}

// Mood display keeps inner thought but strips camera/action narration.
const moodContext = vm.createContext({ moodNow: () => 50 });
vm.runInContext(functionSource("moodInnerMonologue"), moodContext);
const mood = moodContext.moodInnerMonologue({}, "眼神冷下来了，敢骂我，游戏别想玩了");
assert.doesNotMatch(mood, /眼神|目光|视线/);
assert.match(mood, /敢骂我/);

// Voice lengths are logical, capped at 60 seconds, and actual over-limit audio is rejected.
const voiceContext = vm.createContext({ VOICE_MAX_SECONDS: 60 });
vm.runInContext(functionSource("stripSpoken"), voiceContext);
vm.runInContext(functionSource("ttsCleanBase"), voiceContext);
vm.runInContext(functionSource("voiceEstimatedSeconds"), voiceContext);
assert.ok(voiceContext.voiceEstimatedSeconds("我马上回来，等我一下。") < 10);
assert.equal(voiceContext.voiceEstimatedSeconds("很长的话。".repeat(200)), 60);
assert.match(source, /if\(dec\.duration>VOICE_MAX_SECONDS\+\.25\)/);
assert.match(source, /if\(dur>VOICE_MAX_SECONDS\)/);
assert.match(source, /dur:voiceEstimatedSeconds\(t\)/);
const loadingRule = html.match(/\.voiceb\.loading\{([^}]*)\}/)?.[1] || "";
assert.doesNotMatch(loadingRule, /background|color|opacity/);

// Auto remarks allow persona-specific names and reject one repeated generic label across roles.
const remarkContext = vm.createContext({ S: { contacts: [] }, Date });
vm.runInContext(functionSource("roleRemarkApply"), remarkContext);
const one = { id: "one", remark: "甲" };
const two = { id: "two", remark: "乙" };
remarkContext.S.contacts = [one, two];
assert.equal(remarkContext.roleRemarkApply(one, "老公"), true);
assert.equal(remarkContext.roleRemarkApply(two, "老公"), false);
assert.equal(remarkContext.roleRemarkApply(two, "伦敦先生"), true);
assert.match(source, /老公\/老婆[^\n]{0,80}绝不是默认答案/);

// Orders reflow instead of placing action buttons over product text.
assert.match(html, /\.orderrow\{/);
assert.match(html, /\.orderactions\{/);
assert.match(source, /class="orderactions"/);

// Location uses each side's own source, supports London, pinch zoom, and cached precise geolocation.
assert.match(source, /\{n:'伦敦',country:'英国'/);
assert.match(source, /roleLoc=me\?roleLiveLoc\(c\):shared,myLoc=me\?shared:meLiveLoc\(\)/);
assert.match(source, /pointers:new Map\(\)/);
assert.match(source, /ps\.length===2/);
assert.match(source, /navigator\.geolocation\.getCurrentPosition/);
assert.match(source, /Date\.now\(\)-\(cached\.ts\|\|0\)<5\*60000/);

// Offline memory exposes and executes both one-paragraph and split-summary paths.
assert.match(source, /function offSummaryMode\(\)/);
assert.match(source, /async function offSummarySinglePoint\(/);
assert.match(source, /全文只能是一整段：不分段、不列点/);
assert.match(source, /if\(mode==='single'\)\{const point=await offSummarySinglePoint/);
assert.match(source, /整场一条<\/button>/);
assert.match(source, /拆成多条<\/button>/);

// A spoken line replaces an action subtitle before TTS generation can stall the screen.
assert.match(source, /if\(video&&followedAction\)show\(\)/);
assert.match(source, /if\(isAction\)[\s\S]{0,180}Math\.min\(980/);

console.log("experience fixes tests passed");
