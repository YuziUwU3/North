import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const backend = fs.readFileSync(new URL("../supabase/functions/phone-ai/index.ts", import.meta.url), "utf8");

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `missing ${name}`);
  const next = source.indexOf("\nfunction ", start + 9);
  return source.slice(start, next < 0 ? source.length : next);
}

const context = vm.createContext({});
vm.runInContext(functionSource(app, "sanitizeRolePhotoScene"), context);
vm.runInContext(functionSource(app, "rolePhotoPromptLocked"), context);

const sanitized = context.sanitizeRolePhotoScene("拍一张露脸、完整正脸、清晰侧脸、看镜头的镜子自拍");
assert.doesNotMatch(sanitized, /露脸|正脸|侧脸|看镜头|镜子自拍|镜中自拍|对镜自拍|五官|面部|脸部/);

const locked = context.rolePhotoPromptLocked("character wearing a suit");
assert.equal((locked.match(/ABSOLUTE COMPOSITION RULE: NO FACE MAY APPEAR/g) || []).length, 2);
assert.match(locked, /crop the entire head out above the neck/);
assert.match(locked, /No eyes, nose, mouth, facial profile, facial reflection/);

assert.match(app, /aiRelay\('image',\{prompt,size:'1024x1536',source:'role_photo'\}\)/);
assert.match(app, /【最高优先级构图锁】整张图片绝对不能出现任何人的脸或可辨认五官/);
assert.match(app, /人物入镜时必须把整个头部裁到画面外/);
assert.match(app, /【最终检查】画面中零张脸、零个可见五官/);
assert.match(app, /无脸硬规则，优先级最高/);

assert.match(backend, /const ROLE_PHOTO_NO_FACE_GUARD = `ABSOLUTE ROLE-PHOTO COMPOSITION LOCK:/);
assert.match(backend, /const rolePhoto = String\(body\.source \|\| ""\) === "role_photo"/);
assert.match(backend, /guardedImagePrompt\(body\.prompt, rolePhoto\)/);
assert.match(backend, /guardedChatImagePrompt\(body\.prompt, size, rolePhoto\)/);
assert.match(backend, /This lock overrides every other prompt sentence/);
assert.doesNotMatch(backend, /If a person is requested, avoid a clear front-facing face by using a natural side/);
