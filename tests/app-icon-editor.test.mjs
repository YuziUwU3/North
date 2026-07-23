import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

const listStart = source.indexOf("const HOMEAPPS=");
const listEnd = source.indexOf("function appIconEditor", listStart);
assert.ok(listStart >= 0 && listEnd > listStart, "missing app icon editor list");
const list = source.slice(listStart, listEnd);

assert.match(list, /\['phoneapp','☎','电话'\]/);
assert.match(list, /\['douyin','🎵','抖音'\]/);
assert.match(source, /function setAppIcon\(key\)[\s\S]*?S\.me\.appIcons\[key\]=await compress/);
assert.match(source, /function appCell\(k\)[\s\S]*?aIco\(a\.icon\|\|k,a\.e,a\.c,badge\+lockLayer\)/);

console.log("app icon editor tests passed");
