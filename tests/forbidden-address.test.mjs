import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

assert.match(app, /function forbiddenAddressTerms\(c\)/);
assert.match(app, /function forbiddenAddressPrompt\(c\)/);
assert.match(app, /function contentHasForbiddenAddress\(content,c\)/);
assert.match(app, /function applyForbiddenAddressFallback\(content,c\)/);

assert.match(app, /不允许\|不能\|禁止\|严禁/);
assert.match(app, /两个字\|这个称呼\|这种称呼\|这种叫法/);
assert.match(app, /# 禁用称呼硬规则（最高优先级，输出前必须自检）/);
assert.match(app, /世界书\/人设\/记忆明确禁止的称呼/);
assert.match(app, /绝对不能出现在任何可见文字、语音原文、语音翻译、动作旁白或图片描述里/);
assert.match(app, /if\(contentHasForbiddenAddress\(content,c\)\)/);
assert.match(app, /else content=applyForbiddenAddressFallback\(content,c\)/);

const start = app.indexOf("function addrEscRe");
const end = app.indexOf("function lifeNoteAdd", start);
assert.ok(start >= 0 && end > start, "missing forbidden address helper block");
const context = vm.createContext({
  S: {
    me: { name: "我", persona: "" },
    worldbook: [{ enabled: true, contacts: ["c1"], content: "世界书：不允许叫丫头两个字，可以叫宝贝。" }],
  },
  memoryList() { return ["我不喜欢被叫「笨蛋」"]; },
  memoryScopeKey() { return "main"; },
  memoryText(x) { return x; },
  summaryList(c) { return c.summaries || []; },
  summaryCleanText(c, t) { return t || ""; },
});
vm.runInContext(app.slice(start, end), context);

const role = {
  id: "c1",
  persona: "人设里写着禁止叫「小朋友」。",
  callme: "宝贝",
  summaries: [{ text: "不要叫我坏丫头这个称呼" }],
};
const terms = context.forbiddenAddressTerms(role);
assert.ok(terms.includes("丫头"));
assert.ok(terms.includes("笨蛋"));
assert.ok(terms.includes("小朋友"));
assert.ok(terms.includes("坏丫头"));
assert.equal(context.applyForbiddenAddressFallback("丫头，过来", role), "宝贝，过来");

console.log("forbidden address tests passed");
