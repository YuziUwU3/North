import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

function functionSource(name) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `missing ${name}`);
  const next = source.indexOf("\nfunction ", start + 9);
  return source.slice(start, next < 0 ? source.length : next);
}

const context = vm.createContext({});
vm.runInContext(functionSource("sttLangCode"), context);
vm.runInContext(functionSource("sttApiLang"), context);

assert.equal(context.sttLangCode("zh-CN"), "zh-CN");
assert.equal(context.sttLangCode("英"), "en-US");
assert.equal(context.sttLangCode("en-US"), "en-US");
assert.equal(context.sttLangCode("日"), "ja-JP");
assert.equal(context.sttLangCode("韩"), "ko-KR");
assert.equal(context.sttApiLang("zh-CN"), "zh");
assert.equal(context.sttApiLang("en-US"), "en");
assert.equal(context.sttApiLang("ja-JP"), "ja");
assert.equal(context.sttApiLang("ko-KR"), "ko");

assert.match(source, /id="s_slang"/);
assert.match(source, /识别语言（只转写，不翻译）/);
assert.match(source, /英文 → 英文文字/);
assert.match(source, /fd\.append\('language',sttApiLang\(a\.lang\)\)/);
assert.match(source, /r\.lang=sttLangCode\(lang\|\|\(\(S\.settings\.stt\|\|\{\}\)\.lang\)\)/);
assert.match(source, /function callHFStart\(\)\{const sr=makeSR\(\)/);
assert.doesNotMatch(source, /function callHFStart\(\)\{const sr=makeSR\('zh-CN'\)/);
