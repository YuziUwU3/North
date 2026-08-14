import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../小手机.html", import.meta.url), "utf8");

const listStart = source.indexOf("const HOMEAPPS=");
const listEnd = source.indexOf("function appIconEditor", listStart);
assert.ok(listStart >= 0 && listEnd > listStart, "missing app icon editor list");
const list = source.slice(listStart, listEnd);

assert.match(list, /\['phoneapp','☎','电话'\]/);
assert.match(list, /\['douyin','🎵','抖音'\]/);
assert.match(source, /function setAppIcon\(key\)[\s\S]*?S\.me\.appIcons\[key\]=await compress/);
assert.match(source, /custom\?' custom-app-icon':''/);
assert.match(source, /object-position:50% 50%/);
assert.match(html, /\.app \.ic\.custom-app-icon\{aspect-ratio:1\/1;min-width:0;max-width:none;flex:0 0 auto;box-sizing:border-box;overflow:hidden\}/);
assert.match(source, /function appCell\(k\)[\s\S]*?aIco\(a\.icon\|\|k,a\.e,a\.c,badge\)\+homeAppLabel\(a\.t,locked\)/);

console.log("app icon editor tests passed");
