import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

assert.match(source, /id="c_av_preview"/);
assert.match(source, /style="flex:1;width:auto;min-width:0"/);
assert.match(source, /title="上传角色头像"/);
assert.match(source, /aria-label="上传角色头像"/);
assert.match(source, /svgIc\('camera',20,'#fff',1\.8\)/);
assert.match(source, /<span>上传头像<\/span>/);
assert.match(source, /if\(preview\)preview\.innerHTML=av\(d,'sm'\)/);
assert.match(source, /toast\('头像已选择，保存后生效'\)/);

console.log("contact avatar upload tests passed");
