import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

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

const context = vm.createContext({
  hasCN: (text) => /[\u3400-\u9fff]/.test(text || ""),
  CJK_RE: /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g,
  splitBubbles: (text) => (text || "").split("\n").map((s) => s.trim()).filter(Boolean),
});

for (const name of [
  "normVoiceLang",
  "callCnTermFix",
  "callNormalizeCnTranslationLine",
  "callNormalizeForeignOrig",
  "callNormalizeLine",
  "callIsActionLine",
  "hasForeign",
  "callBadForeignMix",
  "callBadForeignLine",
  "callDrifted",
]) {
  vm.runInContext(functionSource(name), context);
}

assert.equal(context.callNormalizeLine("(baby。)", "英"), "（宝贝。）");
assert.equal(context.callNormalizeLine("（Baby.）", "英"), "（宝贝.）");
assert.equal(context.callNormalizeLine("Answer先生.", "英"), "Answer me.");
assert.equal(context.callBadForeignMix("Answer先生.", "英"), true);
assert.equal(context.callBadForeignMix("baby嘴还敢硬?", "英语"), true);
assert.equal(context.callBadForeignMix("baby嘴还敢硬?", "en"), true);
assert.equal(context.callBadForeignMix("Answer me.", "英"), false);
assert.equal(context.callBadForeignLine("任务是23:59之前交完", "英语"), true);
assert.equal(context.callBadForeignLine("【凑近镜头笑】", "英语"), false);
assert.equal(context.callDrifted("baby嘴还敢硬?\n（宝贝还敢顶嘴？）", "英语"), true);
assert.equal(context.callDrifted("任务是23:59之前交完\n（任务截止时间是23:59）", "英语"), true);
assert.equal(context.callDrifted("【凑近镜头笑】\nBaby, still talking back?\n（宝贝，还敢顶嘴？）", "英语"), false);
assert.match(source, /英文原文行不能夹中文称谓/);
assert.match(source, /中文翻译必须写“宝贝\/亲爱的”/);

console.log("call format tests passed");
