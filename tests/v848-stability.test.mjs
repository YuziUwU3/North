import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../小手机.html", import.meta.url), "utf8");

function functionSource(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  const body = app.indexOf("{", start);
  let depth = 0;
  for (let i = body; i < app.length; i++) {
    if (app[i] === "{") depth++;
    else if (app[i] === "}" && --depth === 0) return app.slice(start, i + 1);
  }
  throw new Error(`${name} is not balanced`);
}

const resumeSteps = functionSource("resumeSteps");
const toggleSteps = functionSource("toggleSteps");
assert.doesNotMatch(resumeSteps, /requestPermission\(\)/, "reopen must not request motion permission again");
assert.match(resumeSteps, /stepPermissionGranted!==true/);
assert.match(toggleSteps, /stepPermissionGranted=true/);

assert.match(app, /function offReplyItems\(text\)/);
assert.match(app, /上一版没有留下任何可发送的新内容/);
assert.doesNotMatch(app, /看着我，我还在这里。/);
assert.doesNotMatch(app, /信号般的停顿，再继续吧/);

const summaryNames = [
  "summaryAccountProfile",
  "summaryUserLabel",
  "summaryReplaceAliasStable",
  "summaryCollapseAliasRuns",
  "summaryRepairStoredText",
  "summaryStripModelNoise",
  "summaryCleanText",
];
const sandbox = {
  S: {
    me: {
      active: "main",
      name: "North",
      accounts: [{ id: "main", name: "North", callName: "" }],
    },
    contacts: [],
  },
  memoryScopeKey: (aid) => aid || "main",
  actId: () => "main",
  trimSentence: (text, max) => String(text).slice(0, max),
};
vm.runInNewContext(
  summaryNames.map(functionSource).join("\n") +
    ";const c={callme:'NorthNorth'};" +
    "globalThis.once=summaryCleanText(c,'North答应会准时回家。','main');" +
    "globalThis.twice=summaryCleanText(c,globalThis.once,'main');" +
    "globalThis.fixed=summaryRepairStoredText(c,{text:'North'.repeat(5000)+'。真正事实会保留。'},'main');",
  sandbox,
);
assert.equal(sandbox.once, "NorthNorth答应会准时回家。");
assert.equal(sandbox.twice, sandbox.once, "alias cleanup must be idempotent");
assert.ok(sandbox.fixed.length < 700, "existing runaway summary must be compacted");
assert.match(sandbox.fixed, /真正事实会保留/);

assert.doesNotMatch(html, /viewport-fit=cover/);
assert.match(html, /apple-mobile-web-app-status-bar-style" content="default"/);
assert.match(html, /name="theme-color" content="#ff8fab"/);
assert.match(html, /background_color:'#111111',theme_color:'#ff8fab'/);
assert.match(app, /music-app\$\{bg\?' has-bg':''\}/);
assert.match(html, /\.music-app\.has-bg:after/);
assert.match(app, /if\(musicEnsureCurrent\(\)\)_mView='player'/);

console.log("v848 stability tests passed");
