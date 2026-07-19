import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

assert.doesNotMatch(source, /M48 86 q-9 7 -5 16/);
assert.doesNotMatch(source, /M182 86 q9 7 5 16/);
assert.match(source, /stroke-width="1\.05"/);
assert.match(source, /stroke-width="1\.65"/);
assert.match(source, /stroke-linecap="round"/);
assert.match(source, /repeating-radial-gradient\(circle at center/);
assert.match(source, /conic-gradient\(from 218deg/);
assert.match(source, /0 0 18px rgba\(190,205,255,\.2\)/);

console.log("music visual tests passed");
