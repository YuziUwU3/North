import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../小手机.html", import.meta.url), "utf8");

assert.match(source, /class="music-premium"/);
assert.match(source, /class="music-ambient"/);
assert.match(source, /id="m_disk" class="music-vinyl"/);
assert.doesNotMatch(source, /id="m_arm"/);
assert.match(source, /class="music-classic-together"/);
assert.match(source, /class="music-headphone-pair"/);
assert.match(source, /M62 28 C50 41 43 62 48 86/);
assert.match(source, /class="music-classic-distance"/);
assert.match(source, /function musicToggleChat\(\)/);
assert.match(source, /id="musicChatDock" class="music-chat-dock/);
assert.match(source, /mine\?'rgba\(255,255,255,\.98\)'\:'rgba\(72,73,78,\.98\)'/);
assert.match(source, /class="music-library-row/);
assert.match(source, /function musicEnsureCurrent\(\)/);
assert.match(source, /wanted=\(S\.music\.session&&S\.music\.session\.songId\)\|\|S\.music\.lastSongId/);
assert.match(source, /function musicLibraryRowHTML\(/);
assert.match(source, /function renderMusicHome\(\)/);
assert.match(source, /class="music-app"/);
assert.match(source, /class="music-app-actions"/);
assert.match(source, /class="music-home-library"/);
assert.match(source, /class="music-mini"/);
assert.match(source, /function musicOpenPlayer\(/);
assert.match(source, /function musicExpandPlayer\(/);
assert.match(source, /function musicChatContacts\(\)[\s\S]*?filter\(c=>c&&!c\.deleted\)/);
assert.match(source, /function musicChatRows\(cid\)/);
assert.match(source, /function musicChatHistoryModal\(cid\)/);
assert.match(source, /onchange="musicChatHistoryModal\(this\.value\)"/);
assert.match(source, /已删除角色的记录不会在这里显示/);
assert.match(source, /onclick="musicOpenHome\(\)" aria-label="缩小播放器"/);
assert.match(source, /if\(_mView!==\'player\'\|\|!cur\)return renderMusicHome\(\)/);
assert.match(source, /class="music-settings"/);
assert.match(source, /class="music-settings-quick"/);
assert.match(source, /class="music-library-modal"/);
assert.match(source, /class="music-seek-fill"/);
assert.match(html, /\.music-premium\{/);
assert.match(html, /\.music-vinyl\{/);
assert.match(html, /repeating-radial-gradient\(circle at center/);
assert.match(html, /\.music-headphone-pair\{/);
assert.match(html, /\.music-chat-dock\.collapsed \.music-chatbar\{display:none\}/);
assert.match(html, /\.music-app-hero-record\{right:10px!important\}/);
assert.match(html, /--music-red:#eb4d57/);
assert.match(html, /\.music-app\{/);
assert.match(html, /\.music-mini\{/);
assert.match(html, /\.music-home-song\{/);
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

const homeStart = source.indexOf("function renderMusicHome(");
const homeEnd = source.indexOf("function renderMusic(", homeStart);
assert.ok(homeStart >= 0 && homeEnd > homeStart, "music home source must be present");
assert.doesNotMatch(source.slice(homeStart, homeEnd), /<em>\$\{chatCount/,
  "history totals must not masquerade as an unread red badge");

console.log("music visual tests passed");
