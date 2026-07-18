import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

assert.match(source, /id="musicDistanceInput" type="number" min="0" step="0\.1"/);
assert.match(source, /onclick="musicSetDistance\(document\.getElementById\('musicDistanceInput'\)\.value\)"/);
assert.match(source, /id="musicDistanceValue"/);
assert.doesNotMatch(source, /distance:S\.music\.distance\|\|1400/);

const start = source.indexOf("function musicDistanceValue(value)");
const end = source.indexOf("function editMusicDistance()", start);
assert.ok(start >= 0 && end > start);

let saveCalls = 0;
const sandbox = {
  S: { music: { distance: 1400 } },
  musicInit() {},
  save() { saveCalls += 1; },
  toast() {},
  document: { getElementById() { return null; } },
};
vm.runInNewContext(
  source.slice(start, end) +
    ";globalThis.zeroOk=musicSetDistance('0');" +
    "globalThis.zeroValue=S.music.distance;" +
    "globalThis.decimalOk=musicSetDistance('12.34');" +
    "globalThis.decimalValue=S.music.distance;" +
    "globalThis.negativeOk=musicSetDistance('-1');",
  sandbox,
);

assert.equal(sandbox.zeroOk, true);
assert.equal(sandbox.zeroValue, 0);
assert.equal(sandbox.decimalOk, true);
assert.equal(sandbox.decimalValue, 12.3);
assert.equal(sandbox.negativeOk, false);
assert.equal(sandbox.S.music.distance, 12.3);
assert.equal(saveCalls, 2);

console.log("music distance tests passed");
