/* ---------- AI账户 / 内置AI ---------- */
let _aiAcct=null,_aiAcctBusy=false,_aiConnOpen=false,_aiUnlocked=false,_aiAutoTried=false;
function openAIAccount(){if(_aiUnlocked){go('aiaccount');return;}
  openModal(`<h3>AI账户密码</h3><div class="hint">这里是后台测试入口，输入密码后进入。</div>
    <div class="field"><input id="ai_pin" type="password" inputmode="numeric" maxlength="8" placeholder="输入密码"></div>
    <div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="aiUnlock()">进入</button></div>`);
  setTimeout(()=>{const el=$('#ai_pin');if(el){el.focus();el.onkeydown=e=>{if(e.key==='Enter')aiUnlock();};}},60);}
function aiUnlock(){const v=(($('#ai_pin')||{}).value||'').trim();if(v!=='0414'){toast('密码不对');return;}_aiUnlocked=true;closeModal();go('aiaccount');}
function aiCoreInit(){S.settings.aiCore=S.settings.aiCore||{enabled:false,url:GATE_URL+'/functions/v1/phone-ai'};if(!S.settings.aiCore.url)S.settings.aiCore.url=GATE_URL+'/functions/v1/phone-ai';return S.settings.aiCore;}
function aiPrice(k){const p=(_aiAcct&&_aiAcct.pricing)||{chat:10,vision:25,image:120,tts:10,summary:2};return p[k]||0;}
function aiLedgerRows(){const rows=(_aiAcct&&_aiAcct.ledger)||[];return rows.length?rows.map(x=>`<div class="bill"><div><b>${esc(({chat:'聊天',vision:'识图',image:'生图',tts:'语音',summary:'总结',manual:'手动加点',free:'赠送'}[x.feature])||x.feature)}</b><small>${esc((x.created_at||'').replace('T',' ').slice(0,16))} · ${esc(x.status||'')}</small></div><div class="${x.points>=0?'pos':'neg'}">${x.points>0?'+':''}${x.points}</div></div>`).join(''):'<div class="empty">还没有流水</div>';}
function renderAIAccount(){const ac=aiCoreInit();const id=aiUserId();setTimeout(()=>{if(cur().p==='aiaccount'&&!_aiAcct&&!_aiAcctBusy&&!_aiAutoTried)aiAccountRefresh(true,true);},80);
  const bal=_aiAcct&&_aiAcct.account?(_aiAcct.account.points||0):'--';
  const plans=(_aiAcct&&_aiAcct.plans)||[{name:'体验包',amount_cny:9.9,points:1000},{name:'标准包',amount_cny:19.9,points:2300},{name:'大容量包',amount_cny:39.9,points:5000}];
  return `<div class="nav"><span class="l" onclick="back()">‹</span><span class="t">AI账户</span><span class="r" onclick="aiAccountRefresh()">刷新</span></div>
  <div class="scroll" style="background:#0f1117;color:#e8eaf0;padding:12px">
    <div style="background:linear-gradient(135deg,#1f2937,#4f46e5);border-radius:16px;padding:18px 16px;margin-bottom:12px;border:1px solid rgba(255,255,255,.12)">
      <div style="font-size:12px;color:#c7d2fe">小手机内置AI点数</div>
      <div style="font-size:38px;font-weight:700;margin:6px 0">${bal}</div>
      <div style="font-size:12px;color:#cbd5e1;word-break:break-all">用户ID：${esc(id)} <button class="minibtn" onclick="aiCopyId()" style="margin-left:6px">复制</button></div>
    </div>
    <div class="section">
      <div class="it"><span>使用内置AI<br><small style="color:#888">开：聊天/识图/生图走统一后台并扣点；关：使用设置里的自填API</small></span><span class="sw ${ac.enabled?'on':''}" onclick="aiToggleCore()"></span></div>
      <details ${_aiConnOpen?'open':''} ontoggle="_aiConnOpen=this.open" style="padding:0 14px 10px;color:#aaa"><summary style="font-size:13px;padding:8px 0;cursor:pointer">后台连接</summary>
        <div class="hint">正式发布后这里会统一指向你的后台，普通用户不需要改。用户ID每台设备不同，后台地址默认相同。</div>
        <div class="field" style="margin-bottom:8px"><label>内置AI后台地址</label><input id="ai_url" value="${esc(ac.url||'')}" placeholder="${GATE_URL}/functions/v1/phone-ai"></div>
        <div class="btns"><button class="btn g" onclick="aiSaveUrl()">保存后台地址</button><button class="btn p" onclick="aiAccountRefresh(false,true)">测试连接</button></div>
      </details>
    </div>
    <div class="section">
      <div style="padding:12px 14px;font-weight:600;color:#a5b4fc">扣费表</div>
      <div class="it"><span>文字聊天</span><span class="v">${aiPrice('chat')} 点 / 次</span></div>
      <div class="it"><span>识图</span><span class="v">${aiPrice('vision')} 点 / 次</span></div>
      <div class="it"><span>生成图片</span><span class="v">${aiPrice('image')} 点 / 张</span></div>
      <div class="it"><span>语音生成</span><span class="v">${aiPrice('tts')} 点 / 次</span></div>
    </div>
    <div class="section">
      <div style="padding:12px 14px;font-weight:600;color:#a5b4fc">充值套餐</div>
      ${plans.map(p=>`<div class="it"><span>${esc(p.name)}<small style="color:#888">¥${p.amount_cny} · ${p.points}点</small></span><span class="v"><button class="minibtn" onclick="toast('测试版先手动加点；支付接口下一步再接')">待接支付</button></span></div>`).join('')}
    </div>
    <div class="section">
      <div style="padding:12px 14px;font-weight:600;color:#a5b4fc">最近流水</div>
      <div id="ai_ledger">${aiLedgerRows()}</div>
    </div>
    <div class="hint">测试阶段余额默认0。用户ID每台设备不同；后台地址默认走你的统一后台。</div>
  </div>`;}
function aiToggleCore(){const ac=aiCoreInit();ac.enabled=!ac.enabled;save();render();toast(ac.enabled?'已启用内置AI':'已改回自填API');}
function aiSaveUrl(){const ac=aiCoreInit();ac.url=(($('#ai_url')||{}).value||'').trim();save();toast('已保存');}
function aiCopyId(){try{navigator.clipboard&&navigator.clipboard.writeText(aiUserId());}catch(_){}toast('已复制用户ID');}
function aiAccountApplyResult(d){if(!d)return;if(!_aiAcct)_aiAcct={account:{user_id:aiUserId(),points:0},pricing:null,plans:null,ledger:[]};
  if(d.pricing)_aiAcct.pricing=d.pricing;if(d.plans)_aiAcct.plans=d.plans;if(d.ledger)_aiAcct.ledger=d.ledger;if(d.account)_aiAcct.account=d.account;
  if(d.balance!=null){_aiAcct.account=_aiAcct.account||{user_id:aiUserId()};_aiAcct.account.points=d.balance;}
  if(cur().p==='aiaccount')setTimeout(()=>{if(cur().p==='aiaccount')render();},30);}
async function aiAccountRefresh(silent,preserveScroll){if(_aiAcctBusy)return;_aiAcctBusy=true;if(silent)_aiAutoTried=true;let ok=false;try{_aiAcct=await aiRelay('account',{});ok=true;if(!silent)toast('AI账户已刷新');}catch(e){if(!silent)toast('连接失败：'+e.message);}finally{_aiAcctBusy=false;if(ok&&cur().p==='aiaccount'){const sc=$('.scroll'),top=sc?sc.scrollTop:0;render();if(preserveScroll)setTimeout(()=>{const n=$('.scroll');if(n)n.scrollTop=top;},0);}}}
