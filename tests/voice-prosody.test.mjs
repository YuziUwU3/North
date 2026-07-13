import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const backend = fs.readFileSync(new URL("../supabase/functions/phone-ai/index.ts", import.meta.url), "utf8");

function functionSource(name) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `missing ${name}`);
  const brace = source.indexOf("{", start);
  let depth = 0, quote = "", escaped = false, regex = false, regexClass = false, prev = "";
  for (let i = brace; i < source.length; i++) {
    const ch = source[i];
    if (regex) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === "[") regexClass = true;
      else if (ch === "]") regexClass = false;
      else if (ch === "/" && !regexClass) regex = false;
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; continue; }
    if (ch === "/" && source[i + 1] !== "/" && source[i + 1] !== "*" && /[=(,:;!&|?\[{]/.test(prev)) { regex = true; continue; }
    if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return source.slice(start, i + 1);
    if (!/\s/.test(ch)) prev = ch;
  }
  throw new Error(`unterminated ${name}`);
}

const context = vm.createContext({ ttsUseRelay: () => false });
for (const name of ["ttsStyleKind", "ttsCueKind", "ttsAutoCue", "ttsRequestedCue", "tts2p8Interjection", "tts2p8IsInterjectionCue", "ttsFishTags", "ttsFishEmphasis", "ttsFishPerformance", "ttsBracketPerformance", "ttsVoiceProfile"]) {
  vm.runInContext(functionSource(name), context);
}
vm.runInContext(functionSource("fishVoiceItems"), context);

assert.equal(context.ttsRequestedCue("Be meaner. Lower your voice."), "质问");
assert.equal(context.ttsRequestedCue("Please whisper and speak softly."), "低声");
assert.equal(context.ttsCueKind("emotion: angry"), "tense");
assert.equal(context.ttsCueKind("surprised"), "surprised");
assert.equal(context.ttsAutoCue("Tell me why you lied to me.", null), "tense");
assert.equal(context.tts2p8Interjection("Come here.", "亲亲"), "Come here. (lip-smacking)");
assert.equal(context.tts2p8Interjection("I missed you.", "叹气"), "(sighs) I missed you.");
assert.equal(context.tts2p8Interjection("I missed you.", "难过"), "I missed you.");

const minimax28 = { base: "https://api.minimax.io", model: "speech-2.8-turbo" };
const minimax02 = { base: "https://api.minimax.io", model: "speech-02-turbo" };
const eleven3 = { base: "https://api.elevenlabs.io", model: "eleven_v3" };
const fish21 = { base: "https://api.fish.audio", model: "s2.1-pro-free" };
const hume2 = { base: "https://api.hume.ai", model: "octave-2" };
assert.equal(context.ttsStyleKind(eleven3), "eleven");
assert.equal(context.ttsStyleKind(fish21), "fish");
assert.equal(context.ttsStyleKind(hume2), "hume");
assert.equal(context.ttsBracketPerformance("Tell me why you lied.", "questioning", "fish", true), "[frustrated][confident] Tell me [emphasis] why you lied.");
assert.equal(context.ttsBracketPerformance("I am jealous.", "jealous", "fish", true), "[jealous] I am jealous.");
assert.equal(context.ttsBracketPerformance("Please whisper.", "whisper", "fish", true), "[whispering] Please whisper.");
assert.equal(context.ttsBracketPerformance("Tell me the truth.", "质问", "eleven", true), "[angry, controlled] Tell me the truth.");
assert.equal(context.ttsBracketPerformance("Come here.", "亲亲", "fish", true), "[kissing softly] Come here.");
context.ttsCleanBase = (x) => String(x || "").trim();
context.ttsSafeProsody = (x) => x;
context.VOICE_MAX_CHARS = 300;
vm.runInContext(functionSource("ttsPerformanceText"), context);
assert.equal(context.ttsPerformanceText("Come here.", null, minimax28, { cue: "亲亲" }), "Come here. (lip-smacking)");
assert.equal(context.ttsPerformanceText("Come here.", null, minimax28, { cue: "亲亲", interjection: false }), "Come here.");
assert.equal(context.ttsPerformanceText("Come here.", null, minimax02, { cue: "亲亲" }), "Come here.");
assert.equal(context.ttsPerformanceText("Tell me.", null, eleven3, { cue: "质问" }), "[angry, controlled] Tell me.");
assert.equal(context.ttsPerformanceText("Come here.", null, fish21, { cue: "亲亲" }), "[kissing softly] Come here.");
assert.deepEqual(
  JSON.parse(JSON.stringify(context.ttsVoiceProfile("Tell me why.", { cue: "angry" }, minimax28))),
  { speed: 1, vol: 1, pitch: 0, emotion: "angry" },
);
assert.equal(context.ttsVoiceProfile("No way!", { cue: "surprised" }, minimax28).pitch, 0);
assert.equal(context.ttsVoiceProfile("I am hurt.", { cue: "sad" }, minimax28).emotion, "sad");
assert.equal(context.ttsVoiceProfile("Tell me why.", { cue: "angry" }, minimax02).emotion, undefined);
assert.equal(context.ttsVoiceProfile("Come here.", { cue: "亲亲" }, minimax28).emotion, undefined);
assert.equal(context.ttsVoiceProfile("I miss you.", { cue: "warm" }, minimax28).emotion, undefined);
assert.equal(JSON.stringify({ emotion: context.ttsVoiceProfile("I miss you.", { cue: "warm" }, minimax28).emotion }), "{}");
assert.equal(JSON.parse(JSON.stringify({ emotion: context.ttsVoiceProfile("Tell me why.", { cue: "angry" }, minimax28).emotion })).emotion, "angry");
for (const cue of ["angry", "sad", "happy", "surprised", "fearful", "disgusted", "whisper", "kiss"]) {
  const profile = context.ttsVoiceProfile("Keep my voice.", { cue }, minimax28);
  assert.equal(profile.pitch, 0, `${cue} changed pitch`);
  assert.equal(profile.speed, 1, `${cue} changed speed`);
  assert.equal(profile.vol, 1, `${cue} changed volume`);
}

assert.match(source, /model:'speech-02-turbo',voice_setting:vp/);
assert.match(source, /ttsRelayOn\(t\)&&!ttsExternalOn\(t\)/);
assert.match(source, /try\{if\(ttsUseRelay\(\)\)\{const d=await aiRelay\('tts_voices'/);
assert.match(backend, /model = "speech-02-turbo"/);
assert.match(backend, /voice_setting: \{ voice_id: voiceId, \.\.\.safeTTSVoiceSetting\(setting\) \}/);
assert.match(backend, /if \(chars > 300\)/);

const route = { enabled: true, relay: false, base: "https://api.minimax.io", key: "sk-direct" };
const routeContext = vm.createContext({
  ttsCfg: () => route,
  aiCoreUrl: () => "https://relay.test/functions/v1/phone-ai",
});
for (const name of ["ttsExternalOn", "ttsRelayOn", "ttsEnabled", "ttsUseRelay"]) {
  vm.runInContext(functionSource(name), routeContext);
}
assert.equal(routeContext.ttsUseRelay(), false, "external MiniMax must stay external");
route.relay = true;
assert.equal(routeContext.ttsUseRelay(), false, "external credentials must not be shadowed by relay");
route.base = "";
route.key = "";
assert.equal(routeContext.ttsUseRelay(), true, "relay should be used only without external credentials");

assert.match(source, /model:tts\.model\|\|'speech-02-turbo'/);
assert.match(source, /'https:\/\/api\.elevenlabs\.io','eleven_v3'/);
assert.match(source, /'https:\/\/api\.fish\.audio','s2\.1-pro-free'/);
assert.match(source, /'https:\/\/api\.hume\.ai','octave-2'/);
assert.match(source, /'X-Hume-Api-Key':tts\.key/);
assert.match(source, /function ttsFishTags/);
assert.match(source, /function ttsFishPerformance/);
assert.match(source, /aiRelay\('external_tts',\{provider:'fish'/);
assert.match(source, /stripCallControlTags\(l,c,_call\.id,video\)/);
assert.match(source, /if\(!keepActions\)t=t\.replace\(\/【\[\^】\]\*】\/g,''\)/);
assert.match(source, /function fishVoiceItems/);
assert.match(source, /base\+'\/model\?self=true&page_size=100'/);
assert.deepEqual(JSON.parse(JSON.stringify(context.fishVoiceItems({ items: [{ _id: "fish-voice-id", title: "我的克隆" }] }))), [
  { id: "fish-voice-id", name: "我的克隆", clone: true },
]);
assert.match(backend, /if \(action === "external_tts"\)/);
assert.match(backend, /async function externalFishTTS/);
assert.match(backend, /headers\.model = model/);

console.log("voice prosody tests passed");
