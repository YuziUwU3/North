import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const account=fs.readFileSync(path.join(root,'ai-account.js'),'utf8');
const backend=fs.readFileSync(path.join(root,'supabase/functions/phone-ai/index.ts'),'utf8');
const setup=fs.readFileSync(path.join(root,'AI_BACKEND_SETUP.md'),'utf8');

assert.match(app,/function aiImageRelayOn\(\)\{return !!\(aiImageInit\(\)\.enabled&&aiCoreUrl\(\)\);\}/);
assert.match(app,/if\(aiImageRelayOn\(\)\)\{const d=await aiRelay\('image'/);
assert.match(app,/function imageGenerationAvailable\(\)/);
assert.doesNotMatch(app,/if\(aiCoreOn\(\)\)\{const d=await aiRelay\('image'/);

assert.match(account,/启用图片生成/);
assert.match(account,/官方图片生成/);
assert.match(account,/图片生成套餐/);
assert.match(account,/生成一张图片/);
assert.match(account,/quality:'medium'/);
assert.match(account,/function aiGenerateAccountImage\(\)/);
assert.match(account,/function aiImageReady\(\)/);
assert.match(account,/官方图片密钥尚未部署/);
assert.match(account,/AI_PURCHASE_NOTICE='点数请按需购买，少量多次。/);
assert.match(account,/更换浏览器会导致点数消失/);
assert.match(account,/如因换浏览器或手机而导致点数消失，概不负责/);

assert.match(backend,/image: 30/);
assert.match(backend,/Deno\.env\.get\("OPENAI_IMAGE_API_KEY"\)/);
assert.match(backend,/fetch\("https:\/\/api\.openai\.com\/v1\/images\/generations"/);
assert.match(backend,/quality: "medium"/);
assert.match(backend,/provider: "official-openai"/);
assert.match(backend,/capabilities: \{ image: !!Deno\.env\.get\("OPENAI_IMAGE_API_KEY"\) \}/);
assert.match(backend,/await refund\(userId, clientSecret, "image", c\.cost, c\.ledgerId, reason\)/);
assert.match(backend,/refunded: c\.cost/);
assert.match(backend,/billed: false/);
assert.doesNotMatch(backend,/body\.model \|\| Deno\.env\.get\("IMAGE_MODEL"\)/);

assert.match(setup,/OPENAI_API_KEY=你的聊天\/识图中转站 key/);
assert.match(setup,/OPENAI_IMAGE_API_KEY=你的官方 OpenAI API Key/);
assert.match(setup,/不会读取或覆盖聊天中转站的 `OPENAI_BASE_URL`/);

console.log('AI image account tests passed');
