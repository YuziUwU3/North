import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "小手机.html"), "utf8");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");

assert.match(html, /min-height:100vh;min-height:100dvh/);
assert.match(html, /\.phone\{width:100vw;height:100vh;height:100dvh/);
assert.match(html, /\.livemap\{height:calc\(100vh - 44px\);height:calc\(100dvh - 44px\)/);
assert.match(html, /controllerchange[\s\S]*?sessionStorage\.getItem\(key\)[\s\S]*?location\.replace/);
assert.doesNotMatch(html.match(/controllerchange[\s\S]*?\}\);/)?.[0] || "", /if\(window\.__northBootReady\)return/);
assert.match(sw, /if\(request\.mode==='navigate'\)[\s\S]*?const cached=await currentCore\(cache,'html'\);[\s\S]*?if\(cached\)return cached;/);
assert.match(app, /function androidResumeRepair\(force\)[\s\S]*?if\(!force&&host&&host\.firstElementChild\)/);
assert.match(app, /pageshow',e=>[\s\S]*?androidResumeRepair\(!!e\.persisted\)/);

assert.match(app, /function clearVoiceAudio\(m\)[\s\S]*?URL\.revokeObjectURL\(m\._aurl\)/);
assert.match(app, /function downloadBlob\(blob,name\)[\s\S]*?URL\.revokeObjectURL\(url\)/);
assert.doesNotMatch(app, /a\.href=URL\.createObjectURL\(blob\)/);

assert.match(app, /let _uiConfirmDone=null;/);
assert.match(app, /function uiConfirm\(msg,opt\)\{opt=opt\|\|\{\};if\(_uiConfirmDone\)_uiConfirmDone\(false\)/);
assert.match(app, /let settled=false;const done=v=>\{if\(settled\)return;/);

const defs = app.match(/const APPDEFS=\{([\s\S]*?)\};\s*const APPRUN=/)?.[1] || "";
const runs = app.match(/const APPRUN=\{([\s\S]*?)\};\s*const APP_PAGES=/)?.[1] || "";
const defKeys = [...defs.matchAll(/(?:^|,)\s*([a-z][a-z0-9]*):\{/g)].map((m) => m[1]).sort();
const runKeys = [...runs.matchAll(/(?:^|,)\s*([a-z][a-z0-9]*):/g)].map((m) => m[1]).sort();
assert.ok(defKeys.length > 10, "app registry must contain the desktop apps");
assert.deepEqual(runKeys, defKeys, "every desktop app must have a launch handler");

console.log("platform stability tests passed");
