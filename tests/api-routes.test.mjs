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
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; continue; }
    if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

assert.match(source, /const CHAT_ROUTE_NAMES=\['路线一','路线二','路线三','路线四'\]/);
assert.match(source, /data-chat-route="\$\{i\}"/);
assert.match(source, /每条路线独立保存接口地址、Key、模型、随机度和回复长度/);
assert.match(source, /routes\[routeActive\]=chatRouteCopy\(S\.settings\.chat\)/);

const fields = {
  s_cbase: { value: "https://one.example/v1" },
  s_ckey: { value: "sk-one" },
  s_cmodel: { value: "model-one" },
  s_ctemp: { value: "0.7" },
  s_cmax: { value: "800" },
  testC: { textContent: "old" },
};
const context = vm.createContext({
  S: { settings: { chat: { base: "https://old.example/v1", key: "sk-old", model: "old", temp: 0.8, maxTokens: 900 } } },
  CHAT_ROUTE_NAMES: ["路线一", "路线二", "路线三", "路线四"],
  $: (selector) => fields[String(selector).replace(/^#/, "")] || null,
  document: { querySelectorAll: () => [] },
  save: () => { context.saved = (context.saved || 0) + 1; },
  toast: (text) => { context.toastText = text; },
});
for (const name of ["chatRouteCopy", "chatRoutesInit", "chatRouteSummary", "chatRouteCaptureForm", "chatRouteFillForm", "chatRouteRefreshUI", "chatRouteSwitch"]) {
  vm.runInContext(functionSource(name), context);
}

let routes = context.chatRoutesInit();
assert.equal(routes.length, 4);
assert.equal(routes[0].base, "https://old.example/v1");
assert.equal(routes[1].base, "");

context.chatRouteSwitch(1);
assert.equal(context.S.settings.chatRoutes[0].key, "sk-one", "switching must save the current form first");
assert.equal(context.S.settings.chatRouteActive, 1);
assert.equal(context.S.settings.chat.base, "");
assert.equal(fields.s_cbase.value, "");
assert.equal(fields.testC.textContent, "");

fields.s_cbase.value = "https://two.example/v1";
fields.s_ckey.value = "sk-two";
fields.s_cmodel.value = "model-two";
fields.s_ctemp.value = "0.5";
fields.s_cmax.value = "1200";
context.chatRouteSwitch(0);
assert.equal(context.S.settings.chatRoutes[1].base, "https://two.example/v1");
assert.equal(context.S.settings.chat.key, "sk-one");
assert.equal(fields.s_cmodel.value, "model-one");
assert.equal(context.saved, 2);

fields.s_cmodel.value = "model-one-edited";
context.chatRouteSwitch(0);
assert.equal(context.S.settings.chat.model, "model-one-edited", "clicking the active route must not restore stale values");
assert.equal(fields.s_cmodel.value, "model-one-edited");
assert.equal(context.saved, 3);

console.log("api route tests passed");
