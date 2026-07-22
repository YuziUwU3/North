import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const account = fs.readFileSync(new URL("../ai-account.js", import.meta.url), "utf8");

assert.match(account, /内置语音语言/);
assert.match(account, /只影响内置AI语音；外置语音仍使用角色里的语言/);
assert.match(account, /function aiSetVoiceLanguage\(lang\)/);
assert.match(account, /relayLang=\['zh','英','日','韩'\]\.includes\(lang\)\?lang:''/);
assert.match(account, /function aiVoiceTestText\(\)/);
assert.match(account, /'英':'Hi, I am testing the cost and sound of this voice\.'/);
assert.match(app, /function ttsContentLang\(c\)/);
assert.match(app, /ttsUseRelay\(\)&&t\.relayLang\?t\.relayLang:role/);
assert.match(app, /_vlang=ttsContentLang\(c\)/);
assert.match(app, /const _lang=ttsContentLang\(c\)/);

console.log("AI voice language tests passed");
