import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const account=read('ai-account.js');
const app=read('app.js');
const backend=read('supabase/functions/phone-ai/index.ts');
const html=read('小手机.html');
const sw=read('sw.js');
const privateManifest=read('native/private-small-phone/Resources/private-phone-web.manifest.json');

assert.match(account,/内置AI的新购买入口已经关闭/);
assert.match(account,/这里只保留老用户的余额、已有音色、历史订单和流水/);
assert.match(account,/历史充值与服务订单/);
assert.match(account,/现有点数可以继续用于已保留的内置功能/);
assert.match(account,/function aiToggleVoiceApi\(\)/);
assert.match(account,/function aiUsePrivateVoice\(id\)/);
assert.match(account,/function aiPurchaseRows\(\)/);
assert.match(account,/function aiLedgerRows\(\)/);

for(const retired of [
  'AI_RECHARGE_FALLBACK','AI_PAYMENT_CHANNELS','AI_CLONE_CONTACT_QR',
  'aiRechargeCards','aiServiceCards','aiOpenRecharge','aiCreatePurchase',
  'aiShowPayment','aiOpenPurchaseClaim','aiSubmitPurchaseClaim',
  'aiShowCloneContact','aiLaunchPayment','pay-assets/'
]) assert.doesNotMatch(account,new RegExp(retired));

assert.doesNotMatch(account,/轻量体验|日常畅聊|深度陪伴|长期相伴|快速音色克隆/);
assert.doesNotMatch(account,/支付宝收款码|微信支付收款码|function aiClaimImageData|function aiSubmitPurchaseClaim/);
assert.doesNotMatch(sw,/pay-assets/);
assert.doesNotMatch(privateManifest,/pay-assets/);
assert.equal(fs.existsSync(path.join(root,'pay-assets')),false,'public payment QR directory must be removed');

assert.match(backend,/plans: \[\]/);
assert.doesNotMatch(backend,/const PLANS\s*=/);
assert.match(backend,/if \(action === "purchase_create"\) \{\s*return json\(\{ ok: false, error: "purchase-channel-closed" \}, 410\);\s*\}/);
assert.match(backend,/if \(action === "purchase_submit"\) \{\s*return json\(\{ ok: false, error: "purchase-channel-closed" \}, 410\);\s*\}/);
assert.match(backend,/purchases: purchases \|\| \[\]/);

assert.match(app,/AI账户的新购买入口已经关闭/);
assert.match(app,/已有点数可以继续/);
assert.match(app,/已经绑定的专属音色仍可以选择和使用/);
assert.match(app,/外置图片怎么用（不属于AI账户）/);

const frontVersion=app.match(/APP_VER='v(\d+)\b/)?.[1];
assert.ok(frontVersion,'frontend version should be numeric');
assert.match(html,new RegExp(`ai-account\\.js\\?v=${frontVersion}\\b`));
assert.match(sw,new RegExp(`north-shell-v${frontVersion}\\b`));

console.log('AI purchase retirement tests passed');
