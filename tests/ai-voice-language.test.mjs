import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const account = fs.readFileSync(new URL("../ai-account.js", import.meta.url), "utf8");

assert.match(account, /内置语音语言/);
assert.match(account, /只影响内置AI语音；外置语音仍使用角色里的语言/);
assert.match(account, /语音扣点明码标价/);
assert.match(account, /1～50字：1点/);
assert.match(account, /51～100字：2点/);
assert.match(account, /101～150字：3点/);
assert.match(account, /最多300字：6点/);
assert.match(account, /生成失败：不扣点/);
assert.match(account, /color:#ff5b6f/);
assert.match(account, /function aiSetVoiceLanguage\(lang\)/);
assert.match(account, /relayLang=\['zh','粤','英','日','韩'\]\.includes\(lang\)\?lang:''/);
assert.match(account, /option value="粤"/);
assert.match(account, /'粤':'我而家試緊呢把聲嘅效果同埋收費。'/);
assert.match(account, /function aiVoiceTestText\(\)/);
assert.match(account, /'英':'Hi, I am testing the cost and sound of this voice\.'/);
assert.match(app, /function ttsContentLang\(c\)/);
assert.match(app, /function ttsLanguageBoost\(c\)/);
assert.match(account, /language_boost:typeof ttsLanguageBoost==='function'\?ttsLanguageBoost\(null\):'auto'/);
assert.match(app, /ttsUseRelay\(\)&&t\.relayLang\?t\.relayLang:role/);
assert.match(app, /_vlang=ttsContentLang\(c\)/);
assert.match(app, /const _lang=ttsContentLang\(c\)/);

console.log("AI voice language tests passed");
