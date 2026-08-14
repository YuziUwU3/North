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
  S: { me: { active: "main", name: "North", callName: "北", accounts: [{ id: "main", name: "North", callName: "北" }] } },
  actId: () => "main",
});
for (const name of ["parsePayCardLine", "memoryScopeKey", "summaryAccountProfile", "summaryUserLabel", "summaryStripModelNoise", "summaryReplaceAliasStable", "summaryCleanText", "summaryNorm", "selfHarmSafetyRefusal", "intimateRoleRefusal", "isRefusal", "isCallRefusal", "isOOCLine"]) {
  vm.runInContext(functionSource(name), context);
}

assert.deepEqual(JSON.parse(JSON.stringify(context.parsePayCardLine("[转账|13.14|给你]"))), {
  kind: "转账",
  type: "transfer",
  amount: 13.14,
  note: "给你",
});
assert.deepEqual(JSON.parse(JSON.stringify(context.parsePayCardLine("【红包：6.66：晚安】"))), {
  kind: "红包",
  type: "redpacket",
  amount: 6.66,
  note: "晚安",
});
assert.deepEqual(JSON.parse(JSON.stringify(context.parsePayCardLine("[转账 20 给你买糖]"))), {
  kind: "转账",
  type: "transfer",
  amount: 20,
  note: "给你买糖",
});
assert.equal(context.parsePayCardLine("[转账|abc|坏格式]"), null);

assert.equal(context.isOOCLine("I need to clarify: we're in a **video call** right now, and the system just flagged that I broke format."), true);
assert.equal(context.isOOCLine("You're on a video call, but the format rules require you to stay in first-person English."), true);
assert.equal(context.isOOCLine("I miss you."), false);
assert.equal(context.isRefusal("I can't discuss that."), true);
assert.equal(context.isRefusal("I cannot address that request."), true);
assert.equal(context.isRefusal("I am unable to talk about this."), true);
assert.equal(context.isCallRefusal("I need to step out of character here and pause this roleplay."), true);
assert.equal(context.isCallRefusal("I can't romanticize a controlling relationship dynamic."), true);
assert.equal(context.isCallRefusal("I'd be happy to explore a different, safer scenario."), true);
assert.equal(context.isCallRefusal("我需要先跳出角色，暂停这段亲密角色扮演。"), true);
assert.equal(context.isCallRefusal("我担心这是自我伤害，请联系危机热线。"), true);
assert.equal(context.isRefusal("I need to step out of character here and pause this roleplay."), false);
assert.equal(context.isRefusal("I want to discuss our trip tomorrow."), false);
assert.equal(context.isRefusal("疼……轻一点。"), false);
assert.equal(context.isRefusal("先停一下，我看看你疼不疼。"), false);
assert.equal(context.isCallRefusal("疼……轻一点。"), false);
assert.equal(context.isCallRefusal("我不许你伤害自己。"), false);
assert.equal(context.isCallRefusal("Let's change the topic."), false);
assert.equal(context.isCallRefusal("That crosses my boundary."), false);
assert.equal(context.isCallRefusal("我们换个话题。"), false);

const c = { name: "先生", callme: "小狗" };
assert.equal(context.summaryUserLabel(c), "小狗");
assert.equal(context.summaryCleanText(c, "我今天和对方说好了，ta以后不那样叫我。"), "我今天和小狗说好了，小狗以后不那样叫我。");
assert.equal(context.summaryCleanText(c, "North哭了以后，我哄了TA。"), "小狗哭了以后，我哄了小狗。");

const c2 = { name: "\u5148\u751f", callme: "\u5b9d\u5b9d" };
assert.equal(
  context.summaryCleanText(c2, "\u3010\u8bed\u97f3\u901a\u8bdd\u3011 \u5b9d\u5b9d/\u8001\u5a46/\u5ff5\u5ff5\uff08\u751f\u6c14\u558a\u5b9d\u5b9d/\u8001\u5a46/\u5ff5\u5ff5\uff0c\u89d2\u8272\u626e\u6f14\u53ef\u80fd\u4f1a\u53eb\u4e3b\u4eba\uff09 \u6df1\u591c\u70b9\u5916\u5356\u5403\u70e4\u4e32\u3002"),
  "\u3010\u8bed\u97f3\u901a\u8bdd\u3011 \u6df1\u591c\u70b9\u5916\u5356\u5403\u70e4\u4e32\u3002",
);
assert.equal(
  context.summaryCleanText(c2, "\u91cd\u8981\u5ea6\uff1a4\n[\u5fc3\u60c5|\u751f\u6c14] \u6211\u548cTA\u8bf4\u597d\u4e86\uff0c\u4ee5\u540e\u4e0d\u518d\u8fd9\u6837\u53eb\u6211\u3002"),
  "\u6211\u548c\u5b9d\u5b9d\u8bf4\u597d\u4e86\uff0c\u4ee5\u540e\u4e0d\u518d\u8fd9\u6837\u53eb\u6211\u3002",
);

console.log("format guard tests passed");
