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

const context = vm.createContext({});
for (const name of ["ttsCueKind", "ttsAutoCue", "ttsRequestedCue", "ttsVoiceProfile"]) {
  vm.runInContext(functionSource(name), context);
}

assert.equal(context.ttsRequestedCue("Be meaner. Lower your voice."), "质问");
assert.equal(context.ttsRequestedCue("Please whisper and speak softly."), "低声");
assert.equal(context.ttsCueKind("emotion: angry"), "tense");
assert.equal(context.ttsCueKind("surprised"), "surprised");
assert.equal(context.ttsAutoCue("Tell me why you lied to me.", null), "tense");

assert.deepEqual(
  JSON.parse(JSON.stringify(context.ttsVoiceProfile("Tell me why.", { cue: "angry" }))),
  { speed: 1.06, vol: 1.5, pitch: -2, emotion: "angry" },
);
assert.equal(context.ttsVoiceProfile("No way!", { cue: "surprised" }).emotion, "surprised");
assert.equal(context.ttsVoiceProfile("I am hurt.", { cue: "sad" }).emotion, "sad");

assert.match(source, /model:'speech-02-turbo',voice_setting:vp/);
assert.match(backend, /model = "speech-02-turbo"/);
assert.match(backend, /voice_setting: \{ voice_id: voiceId, \.\.\.safeTTSVoiceSetting\(setting\) \}/);
assert.match(backend, /if \(chars > 300\)/);

console.log("voice prosody tests passed");
