import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert.match(source, /const APP_VER='v629 · 微信退出无表情残留'/);
assert.match(source, /const APP_TAP_MOVE=26,APP_TAP_MS=650,APP_DRAG_MS=620/);
assert.match(source, /onclick="appTap\(event,\\''\+k\+'\\'\)"/);
assert.match(source, /onpointerdown="appDown\(event,\\''\+k\+'\\'\)"/);
assert.match(source, /function appTap\(e,k\)/);
assert.match(source, /function appLaunch\(k\)/);
assert.match(source, /if\(dx<=APP_TAP_MOVE&&dy<=APP_TAP_MOVE&&dt<APP_TAP_MS\)appLaunch\(k\)/);
assert.match(source, /if\(Math\.abs\(e\.clientX-_aPend\.x\)>APP_TAP_MOVE\|\|Math\.abs\(e\.clientY-_aPend\.y\)>APP_TAP_MOVE\)/);
assert.match(source, /tale:\(\)=>openApp\('tale'\)/);
assert.match(source, /dread:\(\)=>openApp\('dread'\)/);
assert.match(source, /tale:taleStart/);
assert.match(source, /dread:dreadStart/);

console.log("android app launch tests passed");
