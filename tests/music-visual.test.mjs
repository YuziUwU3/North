import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../小手机.html", import.meta.url), "utf8");

assert.match(source, /class="music-premium"/);
assert.match(source, /class="music-ambient"/);
assert.match(source, /id="m_disk" class="music-vinyl"/);
assert.match(source, /id="m_arm" class="music-arm"/);
assert.match(source, /class="music-together-card"/);
assert.match(source, /class="music-library-row/);
assert.match(source, /class="music-seek-fill"/);
assert.match(html, /\.music-premium\{/);
assert.match(html, /\.music-vinyl\{/);
assert.match(html, /repeating-radial-gradient\(circle at center/);
assert.match(html, /\.music-arm:after\{/);
assert.match(html, /--music-red:#eb4d57/);
assert.match(html, /@media\(max-height:720px\)/);
assert.match(source, /music:'<path d="M9\.2 17\.5V7\.2l9\.1-2\.1v9\.2"/);
assert.match(source, /m\.type==='musicinvite'[\s\S]*svgIc\('music',32,'#effcff',1\.45\)/);
assert.match(source, /linear-gradient\(135deg,rgba\(35,91,113,\.96\),rgba\(82,132,152,\.86\) 56%,rgba\(117,163,180,\.78\)\)/);
assert.match(source, /background:linear-gradient\(145deg,rgba\(255,255,255,\.18\),rgba\(255,255,255,\.055\)\)/);

console.log("music visual tests passed");
