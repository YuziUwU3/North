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
assert.doesNotMatch(sanitized, /露脸|正脸|侧脸|看镜头|五官|面部|脸部/);
assert.match(sanitized, /手机完全遮住脸/);

const locked = context.rolePhotoPromptLocked("character wearing a suit");
assert.equal((locked.match(/ABSOLUTE COMPOSITION AND GENDER RULE:/g) || []).length, 1);
assert.match(locked, /phone fully covering the face/i);
assert.match(locked, /keep the head/i);
assert.match(locked, /no face or recognizable facial features may appear/i);
assert.match(locked, /Never use a random stock selfie person/i);
assert.match(locked, /preserve the exact character identity, biological sex, time, lighting, and location/i);
assert.match(locked, /zero women, girls, female bodies, female hands/i);

assert.match(app, /aiRelay\('image',\{prompt:rawPrompt,size:'1024x1536',source:'role_photo'\}\)/);
assert.match(app, /function roleVisualIdentity\(c\)/);
assert.match(app, /Same exact character identity and biological sex, no gender swap, no random stock selfie/);
assert.match(app, /function rolePhotoSceneLogic\(c,rawScene\)/);
assert.match(app, /当前真实时间是/);
assert.match(app, /照片背景、光线、衣着状态和上一句聊天必须连贯/);
assert.match(app, /不能生成白天、海边、飞机窗边、咖啡店等无关背景/);
assert.match(app, /你的样子\|现在的样子\|看看你\|看你\|想看你\|想看看你/);
assert.match(app, /【最高优先级构图锁】整张图片绝对不能出现任何人的脸或可辨认五官/);
assert.match(app, /不要默认把整个头部裁掉/);
assert.match(app, /手机完全挡住整张脸/);
assert.match(app, /【最终检查】画面中零张脸、零个可见五官/);
assert.match(app, /遮脸硬规则，优先级最高/);
assert.match(app, /function retryGeneratedImage\(cid,mid\)/);
assert.match(app, /上游限流或没有成功出图，点数已退回/);
assert.match(app, /点这里重试/);

assert.match(backend, /const ROLE_PHOTO_NO_FACE_GUARD = `ABSOLUTE ROLE-PHOTO COMPOSITION LOCK:/);
assert.match(backend, /const rolePhoto = String\(body\.source \|\| ""\) === "role_photo"/);
assert.match(backend, /generateImageThroughRoute\(route, body\.prompt, size, rolePhoto\)/);
assert.match(backend, /guardedImagePrompt\(rawPrompt, rolePhoto\)/);
assert.match(backend, /guardedChatImagePrompt\(rawPrompt, size, rolePhoto\)/);
assert.match(backend, /This lock overrides every other prompt sentence/);
assert.match(backend, /keep the head and hair silhouette/i);
assert.match(backend, /phone fully covers the whole face/i);
assert.match(backend, /Do not substitute a random stock selfie person/i);
assert.match(backend, /background, lighting, and location must follow the time and scene logic/i);
assert.match(backend, /same current character with the exact gender and identity/i);
assert.doesNotMatch(backend, /same young male character/i);
assert.doesNotMatch(backend, /If a person is requested, avoid a clear front-facing face by using a natural side/);
