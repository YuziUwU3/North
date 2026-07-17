import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const account=fs.readFileSync(path.join(root,'ai-account.js'),'utf8');
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

assert.match(backend,/Deno\.env\.get\("FREE_POINTS"\) \?\? 30/);
assert.match(backend,/action === "purchase_create"/);
assert.match(backend,/PLANS\.find\(\(item\) => item\.id === planId\)/);
assert.match(backend,/provider !== "alipay" && provider !== "wechat"/);
assert.match(backend,/from\("phone_ai_purchases"\)[\s\S]*status: "pending"/);
assert.match(backend,/purchases: purchases \|\| \[\]/);

assert.match(sql,/for update/i);
assert.match(sql,/v_purchase\.status <> 'pending'/);
assert.match(sql,/set points = points \+ v_purchase\.points/);
assert.match(sql,/set status = 'paid'/);
assert.match(sql,/voice_clone_service/);
assert.match(sql,/if v_purchase\.points > 0 then/);
assert.match(sql,/revoke all on function phone_ai_confirm_purchase\(uuid, text\) from anon/);

assert.match(account,/function openAIAccount\(\)\{_aiUnlocked=true;go\('aiaccount'\);\}/);
assert.match(account,/function aiCreatePurchase\(planId,provider\)/);
assert.match(account,/function aiShowPayment\(purchase,plan,note,channel\)/);
assert.match(account,/function aiShowCloneContact\(note\)/);
assert.match(account,/aiPurchaseIsService/);
assert.match(account,/function aiLaunchPayment\(provider,automatic\)/);
assert.match(account,/\.\/pay-assets\/alipay-receive\.jpg/);
assert.match(account,/\.\/pay-assets\/wechat-receive\.jpg/);
assert.match(account,/\.\/pay-assets\/wechat-contact\.jpg/);
assert.match(html,/ai-account\.js\?v=533/);
assert.match(sw,/north-shell-v533/);

for(const file of ['alipay-receive.jpg','wechat-receive.jpg','wechat-contact.jpg']){
  const stat=fs.statSync(path.join(root,'pay-assets',file));
  assert.ok(stat.size>10_000,`${file} should contain a real QR image`);
}

console.log('ai recharge tests passed');
