import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const backend = fs.readFileSync(new URL("../supabase/functions/phone-ai/index.ts", import.meta.url), "utf8");
const account = fs.readFileSync(new URL("../ai-account.js", import.meta.url), "utf8");

function backendFunction(name) {
  const start = backend.indexOf(`function ${name}`);
  assert.ok(start >= 0, `missing ${name}`);
  const brace = backend.indexOf("{", start);
  let depth = 0;
  for (let i = brace; i < backend.length; i++) {
    if (backend[i] === "{") depth++;
    else if (backend[i] === "}" && --depth === 0) return backend.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

function accountFunction(name) {
  const start = account.indexOf(`function ${name}`);
  assert.ok(start >= 0, `missing ${name}`);
  const brace = account.indexOf("{", start);
  let depth = 0;
  for (let i = brace; i < account.length; i++) {
    if (account[i] === "{") depth++;
    else if (account[i] === "}" && --depth === 0) return account.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

const pricing = vm.createContext({ TTS_CHARS_PER_POINT: 50, TTS_MAX_CHARS: 300 });
vm.runInContext(backendFunction("ttsPointCost").replace("chars: number", "chars"), pricing);
for (const [chars, points] of [[1, 1], [50, 1], [51, 2], [100, 2], [101, 3], [250, 5], [300, 6]]) {
  assert.equal(pricing.ttsPointCost(chars), points, `${chars} chars must cost ${points} points`);
}
assert.throws(() => pricing.ttsPointCost(0), /invalid-tts-char-count/);
assert.throws(() => pricing.ttsPointCost(301), /invalid-tts-char-count/);

assert.match(backend, /tts:\s*1,/);
assert.match(backend, /tts_chars_per_point:\s*50,/);
assert.match(backend, /tts_max_chars:\s*300,/);
assert.match(backend, /const ttsCost = ttsPointCost\(chars\)/);
assert.match(backend, /requireBalance\(userId, clientSecret, "tts", ttsCost\)/);
assert.match(backend, /charge\(userId, clientSecret, "tts", ttsCost\)/);
assert.match(backend, /charged_points: ttsCost/);
assert.match(backend, /char_count: chars/);

const generateAt = backend.indexOf("data = await minimaxTTS(text, voiceId, model");
const chargeAt = backend.indexOf('const c = await charge(userId, clientSecret, "tts", ttsCost)');
assert.ok(generateAt >= 0 && chargeAt > generateAt, "TTS must charge only after usable audio is generated");
assert.match(backend, /tts-voice-not-accessible:[\s\S]*?charged:\s*0,[\s\S]*?billed:\s*false/);
const ttsRoute=backend.slice(backend.indexOf('if (action === "tts")'),backend.indexOf('if (action === "tts_refund")'));
assert.doesNotMatch(ttsRoute,/fallback_voice_id|voiceId\s*=\s*DEFAULT_TTS_VOICE/,'an explicitly selected voice must never silently become the system voice');

assert.match(account, /1～50字：1点/);
assert.match(account, /51～100字：2点/);
assert.match(account, /最多300字：6点/);
assert.doesNotMatch(account, /条100字普通语音/);
assert.doesNotMatch(account, /Math\.floor\(Number\(p\.points\|\|0\)\/Math\.max\(1,aiPrice\('tts'\)\)\)/);

const accountPricing = vm.createContext({ _aiAcct: null });
for (const name of ["aiPrice", "aiTtsCharsPerPoint", "aiTtsPointCost", "aiTtsEstimatedCount"]) {
  vm.runInContext(accountFunction(name), accountPricing);
}
assert.equal(accountPricing.aiTtsPointCost(50), 1);
assert.equal(accountPricing.aiTtsPointCost(51), 2);
assert.equal(accountPricing.aiTtsPointCost(300), 6);
assert.equal(accountPricing.aiTtsEstimatedCount(250, 100), 125);
assert.equal(accountPricing.aiTtsEstimatedCount(850, 100), 425);
assert.equal(accountPricing.aiTtsEstimatedCount(1800, 100), 900);
assert.equal(accountPricing.aiTtsEstimatedCount(3200, 100), 1600);
