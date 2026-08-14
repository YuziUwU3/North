import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../小手机.html", import.meta.url), "utf8");

function functionSource(name) {
  const start = app.indexOf(`function ${name}`);
  assert.ok(start >= 0, `missing ${name}`);
  const brace = app.indexOf("{", start);
  let depth = 0, quote = "", escaped = false, regex = false, regexClass = false, prev = "";
  for (let i = brace; i < app.length; i++) {
    const ch = app[i];
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
    if (ch === "/" && app[i + 1] !== "/" && app[i + 1] !== "*" && /[=(,:;!&|?\[{]/.test(prev)) { regex = true; continue; }
    if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return app.slice(start, i + 1);
    if (!/\s/.test(ch)) prev = ch;
  }
  throw new Error(`unterminated ${name}`);
}

const resultContext = vm.createContext({ chatAPI: async () => "unused", joinAIContinuation: (a, b) => a + b });
vm.runInContext(`async ${functionSource("chatResultText")}`, resultContext);
await assert.rejects(
  () => resultContext.chatResultText([], { rejectRefusal: true }, { choices: [{ message: { content: "" }, finish_reason: "content_filter" }] }),
  (error) => error?.code === "model-refusal" && error?.modelRefusal === true,
);
assert.equal(
  await resultContext.chatResultText([], { rejectRefusal: true }, { choices: [{ message: { content: "正常回复" }, finish_reason: "stop" }] }),
  "正常回复",
);

const auxContext = vm.createContext({
  S: { settings: { chat: { base: "https://main.example", key: "main-key", model: "main" }, aux: { model: "aux" } } },
  chatRequestRoute: () => null,
});
vm.runInContext(functionSource("callAuxConfigured"), auxContext);
assert.equal(auxContext.callAuxConfigured(), true);
auxContext.S.settings.chat.key = "";
assert.equal(auxContext.callAuxConfigured(), false);

assert.match(app, /rejectRefusal:true/);
assert.match(app, /_auxAvailable=!_md\.aux&&callAuxConfigured\(_md\.routeIndex\)/);
assert.match(app, /const _switchCallToAux=async reason=>/);
assert.match(app, /_activeCallMd=Object\.assign\(\{\},_md,\{aux:true,noRelay:true\}\)/);
assert.match(app, /content=await _switchCallToAux\(e&&e\.modelRefusal\?'模型明确拒绝了本轮内容':'主模型请求失败'\)/);
assert.match(app, /if\(!_screenShareAutonomy&&!_screenShareAutonomyAnswer\)content=await _guardCallOutput\(content\)/);
assert.match(app, /content=await _guardCallOutput\(content\);[^\n]*if\(_usedAuxFallback\)callSystemNotice\('副模型/);
assert.match(app, /本轮播放副模型内容，下一轮恢复主模型/);
assert.match(app, /本轮已拦截且不会播放/);
assert.match(app, /_realSelfHarmTurn&&isCallRefusal\(candidate\)/);
assert.match(app, /if\(_realSelfHarmTurn&&e&&e\.modelRefusal\)throw callRealSafetyError\(\)/);
assert.match(app, /“停止”“停下”“不要继续”“不玩了”“退出扮演”/);
assert.match(app, /who:systemText\?'system':'them'/);
assert.doesNotMatch(app, /for\(let _ra=0;_ra<2&&isRefusal\(content\)/);
assert.match(html, /\.csline\.system\{/);

console.log("call model fallback tests passed");
