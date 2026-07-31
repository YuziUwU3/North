import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

assert.doesNotMatch(source, /M48 86 q-9 7 -5 16/);
assert.doesNotMatch(source, /M182 86 q9 7 5 16/);
assert.doesNotMatch(source, /M78 2 C98 -3 132 -3 152 2/);
assert.match(source, /M62 28 C50 41 43 62 48 86/);
assert.match(source, /M168 28 C180 41 187 62 182 86/);
assert.doesNotMatch(source, /44\.5 58 C44 69/);
assert.doesNotMatch(source, /185\.5 58 C186 69/);
assert.match(source, /stroke-width="1\.15"/);
assert.match(source, /stroke-linecap="round"/);
assert.match(source, /repeating-radial-gradient\(circle at center/);
assert.doesNotMatch(source, /conic-gradient\(from 218deg/);
assert.match(source, /radial-gradient\(circle at center,#1a1b1f 0,#0c0d0f 42%,#070708 72%,#030304 100%\)/);
assert.match(source, /0 0 18px rgba\(190,205,255,\.2\)/);
assert.match(source, /music:'<path d="M9\.2 17\.5V7\.2l9\.1-2\.1v9\.2"/);
assert.match(source, /m\.type==='musicinvite'[\s\S]*svgIc\('music',32,'#effcff',1\.45\)/);
assert.match(source, /linear-gradient\(135deg,rgba\(35,91,113,\.96\),rgba\(82,132,152,\.86\) 56%,rgba\(117,163,180,\.78\)\)/);
assert.match(source, /background:linear-gradient\(145deg,rgba\(255,255,255,\.18\),rgba\(255,255,255,\.055\)\)/);

console.log("music visual tests passed");
