import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const account=fs.readFileSync(path.join(root,'ai-account.js'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const backend=fs.readFileSync(path.join(root,'supabase/functions/phone-ai/index.ts'),'utf8');
const sql=fs.readFileSync(path.join(root,'supabase_ai_recharge_v533.sql'),'utf8');
const html=fs.readFileSync(path.join(root,'小手机.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');

for(const [id,amount,points] of [
  ['p_990','9.9','250'],
  ['p_2990','29.9','850'],
  ['p_5990','59.9','1800'],
  ['p_9990','99.9','3200']
]){
  assert.match(backend,new RegExp(`id: "${id}".*amount_cny: ${amount.replace('.','\\.')}, points: ${points}`));
  assert.match(account,new RegExp(`id:'${id}'.*amount_cny:${amount.replace('.','\\.')},points:${points}`));
}
assert.match(backend,/id: "svc_clone_1990".*amount_cny: 19\.9, points: 0, kind: "service"/);
assert.match(account,/id:'svc_clone_1990'.*amount_cny:19\.9,points:0,kind:'service'/);

assert.doesNotMatch(backend,/FREE_POINTS|first_open/);
assert.match(backend,/\.insert\(\{ user_id: userId, client_secret: clientSecret, points: 0, free_granted: false \}\)/);
assert.doesNotMatch(account,/新用户赠送|首次赠送/);
assert.match(backend,/action === "purchase_create"/);
assert.match(backend,/PLANS\.find\(\(item\) => item\.id === planId\)/);
assert.match(backend,/provider !== "alipay" && provider !== "wechat"/);
assert.match(backend,/from\("phone_ai_purchases"\)[\s\S]*status: "pending"/);
assert.match(backend,/\.neq\("review_status", "unsubmitted"\)/);
assert.match(backend,/auto-cancelled: replaced by a newer unpaid order/);
assert.match(backend,/too-many-submitted-orders/);
assert.match(backend,/purchases: purchases \|\| \[\]/);

assert.match(sql,/for update/i);
assert.match(sql,/v_purchase\.status <> 'pending'/);
assert.match(sql,/set points = points \+ v_purchase\.points/);
assert.match(sql,/set status = 'paid'/);
assert.match(sql,/voice_clone_service/);
assert.match(sql,/if v_purchase\.points > 0 then/);
assert.match(sql,/revoke all on function phone_ai_confirm_purchase\(uuid, text\) from anon/);

assert.match(account,/function openAIAccount\(\)\{go\('aiaccount'\);\}/);
assert.doesNotMatch(account,/ai_pin|ai_core_pin|aiCoreUnlock|0414|206414|管理密码/);
assert.match(app,/输入 \$\{esc\(c\.remark\|\|c\.name\)\} 的手机密码/);
assert.match(app,/function spyChangePwd\(id\)/);
assert.match(account,/function aiCreatePurchase\(planId,provider\)/);
assert.match(account,/function aiShowPayment\(purchase,plan,note,channel\)/);
assert.match(account,/没有截图不会进入后台核对，也不会自动加点/);
assert.match(account,/function aiShowCloneContact\(note\)/);
assert.match(account,/必须先添加办理微信，才能办理/);
assert.match(account,/function aiOpenPurchaseOrder\(id\)/);
assert.match(account,/重新打开本订单；届时会自动显示办理微信二维码/);
assert.match(account,/onclick="aiOpenPurchaseOrder\('\$\{esc\(x\.id\)\}'\)">打开订单<\/button>/);
const paymentFlow=account.slice(account.indexOf('function aiShowPayment'),account.indexOf('function aiClaimPurchase'));
assert.doesNotMatch(paymentFlow,/aiShowCloneContact/);
assert.match(account,/aiPurchaseIsService/);
assert.match(account,/function aiLaunchPayment\(provider,automatic\)/);
assert.doesNotMatch(account,/wxp:\/\//);
assert.match(account,/\.\/pay-assets\/alipay-receive\.jpg/);
assert.match(account,/\.\/pay-assets\/wechat-receive\.jpg/);
assert.match(account,/\.\/pay-assets\/wechat-contact\.jpg/);
const frontVersion=app.match(/APP_VER='v(\d+)\b/)?.[1];
assert.ok(frontVersion,'frontend version should be numeric');
assert.match(html,new RegExp(`ai-account\\.js\\?v=${frontVersion}\\b`));
assert.match(sw,new RegExp(`north-shell-v${frontVersion}\\b`));

for(const file of ['alipay-receive.jpg','wechat-receive.jpg','wechat-contact.jpg']){
  const stat=fs.statSync(path.join(root,'pay-assets',file));
  assert.ok(stat.size>10_000,`${file} should contain a real QR image`);
}

console.log('ai recharge tests passed');
