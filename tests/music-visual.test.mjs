import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

assert.doesNotMatch(source, /M48 86 q-9 7 -5 16/);
assert.doesNotMatch(source, /M182 86 q9 7 5 16/);
assert.doesNotMatch(source, /M78 2 C98 -3 132 -3 152 2/);
assert.match(source, /M56 22 C49 34 45 46 44\.5 58/);
assert.match(source, /M174 22 C181 34 185 46 185\.5 58/);
assert.match(source, /stroke-width="1\.4"/);
assert.match(source, /stroke-width="\.85"/);
assert.match(source, /stroke-linecap="round"/);
assert.match(source, /repeating-radial-gradient\(circle at center/);
assert.match(source, /conic-gradient\(from 218deg/);
assert.match(source, /0 0 18px rgba\(190,205,255,\.2\)/);

console.log("music visual tests passed");
