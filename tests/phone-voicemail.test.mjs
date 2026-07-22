import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

function functionSource(name) {
  const start = source.indexOf(`function ${name}`);
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
    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

const fallbackContext = vm.createContext({
  S: { me: { name: "North", callName: "小北" } },
  getVoice: (role) => role.voice,
  ttsContentLang: (role) => role.voice.lang,
});
vm.runInContext(functionSource("normVoiceLang"), fallbackContext);
vm.runInContext(functionSource("phVmLang"), fallbackContext);
vm.runInContext(functionSource("phVmFallback"), fallbackContext);

const zh = fallbackContext.phVmFallback({ voice: { lang: "zh" } }, "missed");
const en = fallbackContext.phVmFallback({ voice: { lang: "英" } }, "missed");
const ja = fallbackContext.phVmFallback({ voice: { lang: "日" } }, "missed");
const ko = fallbackContext.phVmFallback({ voice: { lang: "韩" } }, "missed");

assert.match(zh, /我刚才打给你没接/);
assert.doesNotMatch(zh, /[（(]/);
assert.match(en, /^[A-Za-z].*\n（[\u3400-\u9fff]/s);
assert.match(ja, /[ぁ-ヿ].*\n（[\u3400-\u9fff]/s);
assert.match(ko, /[가-힣].*\n（[\u3400-\u9fff]/s);

const roles = new Map([["r1", { id: "r1", name: "角色" }]]);
const roleContext = vm.createContext({
  getC: (id) => roles.get(id) || null,
  phFind: (num) => num === "100" ? { kind: "role", id: "r1" } : { kind: "custom", id: "c1" },
});
vm.runInContext(functionSource("phVmRole"), roleContext);
assert.equal(roleContext.phVmRole({ roleId: "r1", num: "999" }).id, "r1");
assert.equal(roleContext.phVmRole({ num: "100" }).id, "r1");
assert.equal(roleContext.phVmRole({ num: "200" }), null);

assert.match(source, /phAddVoicemail\(num,fallback,\{roleId:cid,lang,role:'assistant',type:'voice',pending:true\}\)/);
assert.match(source, /units\.some\(x=>!x\.orig\|\|!hasForeign\(x\.orig,lang\)\|\|!x\.trans\|\|!hasCN\(x\.trans\)\)/);
assert.match(source, /async function phPlayVM\(id\)\{audioUnlock\(\)/);
assert.match(source, /if\(!c\)\{toast\('语音留言：'.*return;\}/);
assert.match(source, /await speakMsg\(v,c\)/);
assert.match(source, /const voice=Object\.assign\(\{\},getVoice\(c\),\{lang:normVoiceLang\(v\.lang\|\|getVoice\(c\)\.lang\|\|'zh'\)\}\)/);
assert.match(source, /\(p\.voicemail\|\|\[\]\)\.forEach\(clearVoiceAudio\)/);

console.log("phone voicemail tests passed");
