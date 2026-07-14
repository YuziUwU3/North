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

const context = vm.createContext({});
vm.runInContext(functionSource("phSpoofNoWrongSms"), context);

for (const bad of ["认错人了", "不好意思找错人了", "我发错人了", "可能是我弄错人了", "wrong person", "mistaken number"]) {
  const cleaned = context.phSpoofNoWrongSms(bad);
  assert.notEqual(cleaned, bad);
  assert.doesNotMatch(cleaned, /认错|找错|发错|弄错|wrong person|mistaken/i);
}

assert.match(source, /禁止天气、苏州、路过、方便聊吗、猜猜我是谁、打错、发错、认错人、找错人、弄错人、误会了、不认识/);
assert.match(source, /绝对不要说“你是谁\/哪位\/你发给我\/发错了\/认错人\/找错人\/弄错人\/误会了\/不认识\/不是本人”/);

console.log("phone spoof guard tests passed");
