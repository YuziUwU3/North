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
assert.match(source, /function musicEnsureCurrent\(\)/);
assert.match(source, /wanted=\(S\.music\.session&&S\.music\.session\.songId\)\|\|S\.music\.lastSongId/);
assert.match(source, /function musicLibraryRowHTML\(/);
assert.match(source, /class="music-empty-actions"/);
assert.match(source, /class="music-settings"/);
assert.match(source, /class="music-settings-quick"/);
assert.match(source, /class="music-library-modal"/);
assert.match(source, /class="music-seek-fill"/);
assert.match(html, /\.music-premium\{/);
assert.match(html, /\.music-vinyl\{/);
assert.match(html, /repeating-radial-gradient\(circle at center/);
assert.match(html, /\.music-arm:after\{/);
assert.match(html, /--music-red:#eb4d57/);
assert.match(html, /\.music-empty-actions\{/);
assert.match(html, /\.music-settings\{/);
assert.match(html, /\.music-library-modal\{/);
assert.match(html, /@media\(max-height:720px\)/);
assert.match(source, /music:'<path d="M9\.2 17\.5V7\.2l9\.1-2\.1v9\.2"/);
assert.match(source, /m\.type==='musicinvite'[\s\S]*svgIc\('music',32,'#effcff',1\.45\)/);
assert.match(source, /linear-gradient\(135deg,rgba\(35,91,113,\.96\),rgba\(82,132,152,\.86\) 56%,rgba\(117,163,180,\.78\)\)/);
assert.match(source, /background:linear-gradient\(145deg,rgba\(255,255,255,\.18\),rgba\(255,255,255,\.055\)\)/);

const menuStart = source.indexOf("function musicMenu(");
const menuEnd = source.indexOf("function musicChatHistoryModal(", menuStart);
assert.ok(menuStart >= 0 && menuEnd > menuStart, "music menu source must be present");
assert.doesNotMatch(source.slice(menuStart, menuEnd), /[↩🎵🎧🖼]/u);

console.log("music visual tests passed");
