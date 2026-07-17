import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const app = read('app.js');
const account = read('ai-account.js');
const backend = read('supabase/functions/phone-ai/index.ts');
const sql = read('supabase_ai_payment_review_v535.sql');
const adminHtml = read('admin/index.html');
const adminApp = read('admin/app.js');
const adminSw = read('admin/sw.js');
const manifest = JSON.parse(read('admin/manifest.webmanifest'));

assert.match(sql, /phone-ai-payment-proofs/);
assert.match(sql, /public,\s*file_size_limit[\s\S]*false,\s*2097152/i);
assert.match(sql, /review_status text not null default 'unsubmitted'/);
assert.match(sql, /v_purchase\.review_status <> 'submitted'/);
assert.match(sql, /payment reference is required/);
assert.match(sql, /for update/i);
assert.match(sql, /set points = points \+ v_purchase\.points/);
assert.match(sql, /external_order_id = trim\(p_payment_ref\)/);
assert.match(sql, /revoke all on table phone_ai_admin_push from anon/);
assert.match(sql, /revoke all on function phone_ai_confirm_purchase\(uuid, text\) from authenticated/);

assert.match(backend, /action === "purchase_submit"/);
assert.match(backend, /\.eq\("user_id", userId\)/);
assert.match(backend, /proofBytes\(body\.proof_image\)/);
assert.match(backend, /\.from\(PROOF_BUCKET\)[\s\S]*\.upload\(path/);
assert.match(backend, /review_status: "submitted"/);
assert.match(backend, /sendAdminPush\(/);
assert.match(backend, /action === "admin_orders"/);
assert.match(backend, /createSignedUrl\(row\.proof_path, 600\)/);
assert.match(backend, /action === "admin_review"/);
assert.match(backend, /supabase\.rpc\("phone_ai_confirm_purchase"/);
assert.match(backend, /requireAdmin\(req, body\)/);
assert.match(backend, /admin-unauthorized"\) \? 401/);

assert.match(account, /function aiOpenPurchaseClaim\(purchaseId\)/);
assert.match(account, /accept="image\/jpeg,image\/png,image\/webp"/);
assert.match(account, /function aiClaimImageData\(file\)/);
assert.match(account, /purchase_submit/);
assert.match(account, /管理员核对真实账单并确认后/);
assert.match(account, /等待上传凭证/);
assert.match(account, /等待人工核对/);

assert.doesNotMatch(account, />使用内置AI</);
assert.match(app, /function aiCoreOn\(\)\{return false;\}/);
assert.match(app, /if\(!id\|\|!ttsUseRelay\(\)\)return/);

assert.match(adminHtml, /管理员授权码/);
assert.match(adminApp, /确认到账并加点/);
assert.match(adminApp, /admin_auth/);
assert.match(adminApp, /admin_orders/);
assert.match(adminApp, /admin_subscribe/);
assert.match(adminApp, /admin_review/);
assert.match(adminApp, /payment_ref:paymentRef/);
assert.match(adminApp, /setTimeout\(async \(\) =>[\s\S]*15000\)/);
assert.match(adminSw, /self\.addEventListener\('push'/);
assert.match(adminSw, /showNotification/);
assert.match(adminSw, /url\.origin !== self\.location\.origin/);
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.scope, './');

for (const file of ['admin/index.html', 'admin/app.js', 'admin/sw.js', 'admin/manifest.webmanifest', 'ai-account.js', 'app.js']) {
  assert.doesNotMatch(read(file), /ADMIN_ACCESS_TOKEN\s*[:=]\s*['"][^'"]+/);
}

console.log('AI payment review tests passed');
