import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../ai-account.js", import.meta.url), "utf8");

function functionSource(name) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `missing ${name}`);
  const next = source.indexOf("\nfunction ", start + 9);
  return source.slice(start, next < 0 ? source.length : next);
}

const store = new Map();
const context = vm.createContext({
  aiUserId: () => "user-a",
  localStorage: {
    getItem: (key) => store.has(key) ? store.get(key) : null,
    setItem: (key, value) => store.set(key, String(value)),
  },
});
vm.runInContext("var _aiAcct=null", context);
for (const name of ["aiBalanceCacheKey", "aiCachedBalance", "aiRememberBalance", "aiVisibleBalance"]) {
  vm.runInContext(functionSource(name), context);
}

assert.equal(context.aiVisibleBalance(), null);
assert.equal(context.aiRememberBalance(286), 286);
assert.equal(context.aiVisibleBalance(), 286);
vm.runInContext("_aiAcct={account:{user_id:'user-a'}}", context);
assert.equal(context.aiVisibleBalance(), 286, "an incomplete response must keep the last trusted balance");
vm.runInContext("_aiAcct={account:{user_id:'user-a',points:0}}", context);
assert.equal(context.aiVisibleBalance(), 0, "a real zero balance must still display as zero");

assert.doesNotMatch(source, /account:\{user_id:aiUserId\(\),points:0\}/);
assert.match(source, /const knownBalance=aiVisibleBalance\(\),bal=knownBalance==null\?'读取中…':knownBalance/);
assert.match(source, /const d=await aiRelay\('account',\{\}\)/);
assert.doesNotMatch(source, /_aiAcct=await aiRelay\('account',\{\}\)/);
assert.match(source, /_aiAcctFetchedAt=0/);
assert.match(functionSource("renderAIAccount"), /Date\.now\(\)-Number\(_aiAcctFetchedAt\|\|0\)>5000/);
assert.match(functionSource("aiAccountApplyResult"), /if\(action==='account'\)_aiAcctFetchedAt=Date\.now\(\)/);
assert.match(functionSource("renderAIAccount"), /内置AI的新购买入口已经关闭/);
assert.match(functionSource("renderAIAccount"), /这里只保留老用户的余额、已有音色、历史订单和流水/);
