import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../小手机.html", import.meta.url), "utf8");
const sw = fs.readFileSync(new URL("../sw.js", import.meta.url), "utf8");

assert.match(app, /APP_VER='v998 · 动态自主配图与角色资料优化'/);
assert.match(app, /function northUpdateAvailable\(build\)/);
assert.match(app, /发现新版本 v\$\{esc\(build\)\}/);
assert.match(app, /不需要退出或划掉小手机/);
assert.match(app, /function northUpdateReload\(\).*location\.replace\(next\.href\)/s);
assert.match(app, /setInterval\(\(\)=>reg\.update\(\)\.catch\(\(\)=>\{\}\),15\*60\*1000\)/);
assert.match(app, /postMessage\(\{type:'north-version-query'\}\)/);
assert.match(sw, /client\.postMessage\(\{type:'north-update-ready',build:BUILD\}\)/);
assert.match(sw, /event\.data\.type!==['"]north-version-query['"]/);
assert.match(html, /window\.__NORTH_SHELL_BUILD__='998'/);
assert.match(html, /sw\.js\?v=998&r=v998-social-image-profile-1/);

console.log("update prompt tests passed");
