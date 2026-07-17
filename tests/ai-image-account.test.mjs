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
assert.match(app,/function imageGenerateExternal\(base,key,model,prompt,size\)/);
assert.match(app,/gemini-3\.1-flash-image-preview/);
assert.match(app,/gemini-3-pro-image-preview/);

assert.match(account,/启用图片生成/);
assert.match(account,/图片中转站/);
assert.match(account,/图片生成套餐/);
assert.match(account,/生成一张图片/);
assert.match(account,/function aiGenerateAccountImage\(\)/);
assert.match(account,/function aiImageReady\(\)/);
assert.match(account,/图片中转站尚未配置/);
assert.match(account,/生图API原生成功率约50%/);
assert.match(account,/function aiShowPurchaseNotice\(\)/);
assert.match(account,/更换浏览器会导致点数消失/);
assert.match(account,/如因换浏览器或手机而导致点数消失概不负责/);

assert.match(backend,/image: 20/);
assert.match(backend,/Deno\.env\.get\("IMAGE_MODEL"\) \|\| "gpt-image-2"/);
assert.match(backend,/openai\("\/images\/generations"/);
assert.match(backend,/urls\.push\(base \+ "\/v1" \+ path\)/);
assert.match(backend,/function relayImageResult\(data: any\)/);
assert.match(backend,/provider: "configured-relay"/);
assert.match(backend,/quality: "low"/);
assert.match(backend,/response_format: "url"/);
assert.match(backend,/\}, 145000\)/);
assert.match(backend,/function recoverStalePendingCharges\(/);
assert.match(backend,/stale-pending-auto-refund/);
assert.match(backend,/await recoverStalePendingCharges\(userId, clientSecret\)/);
assert.match(backend,/capabilities: \{ image: !!\(Deno\.env\.get\("OPENAI_API_KEY"\) && Deno\.env\.get\("OPENAI_BASE_URL"\)\) \}/);
assert.match(backend,/await refund\(userId, clientSecret, "image", c\.cost, c\.ledgerId, reason\)/);
assert.match(backend,/refunded: c\.cost/);
assert.match(backend,/billed: false/);
assert.doesNotMatch(backend,/OPENAI_IMAGE_API_KEY/);
assert.doesNotMatch(backend,/https:\/\/api\.openai\.com\/v1\/images\/generations/);

assert.match(setup,/OPENAI_API_KEY=你的聊天\/识图中转站 key/);
assert.match(setup,/IMAGE_MODEL=gpt-image-2/);
assert.match(setup,/不需要额外配置官方 OpenAI Key/);

assert.match(account,/点数不足提醒/);
assert.match(account,/function aiCheckLowBalance\(balance\)/);
assert.match(account,/lowBalanceThreshold/);
assert.match(account,/AI点数快用完了/);

console.log('AI image account tests passed');
