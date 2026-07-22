import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../ai-account.js", import.meta.url), "utf8");
const line = (name) => {
  const match = source.match(new RegExp(`^function ${name}\\([^\\n]+$`, "m"));
  assert.ok(match, `missing ${name}`);
  return match[0];
};

const memory = new Map();
const notices = [];
const context = vm.createContext({
  localStorage: {
    getItem: (key) => memory.has(key) ? memory.get(key) : null,
    setItem: (key, value) => memory.set(key, String(value)),
  },
  aiPaidNoticeKey: () => "paid-test-user",
  aiVisibleBalance: () => 0,
  aiShowPointsArrival: (points, balance) => notices.push({ points, balance }),
  clearTimeout: () => {},
  setTimeout: (fn) => { fn(); return 1; },
});
vm.runInContext("let _aiArrivalTimer=0;", context);
vm.runInContext(line("aiPaidNotifiedIds"), context);
vm.runInContext(line("aiDetectPointsArrival"), context);

const paid = { id: "order-1", status: "paid", points: 850 };
context.aiDetectPointsArrival({ purchases: [paid], account: { points: 850 } });
assert.deepEqual(notices, [{ points: 850, balance: 850 }]);

context.aiDetectPointsArrival({ purchases: [paid], account: { points: 850 } });
assert.equal(notices.length, 1, "same paid order must not alert twice");

context.aiDetectPointsArrival({ purchases: [{ id: "order-2", status: "pending", points: 250 }], account: { points: 850 } });
assert.equal(notices.length, 1, "pending order must not announce arrival");

context.aiDetectPointsArrival({ purchases: [paid, { id: "order-3", status: "paid", points: 250 }], account: { points: 1100 } });
assert.deepEqual(notices[1], { points: 250, balance: 1100 });

console.log("AI points arrival tests passed");
