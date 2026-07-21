/* ---------- AI账户 / 内置AI ---------- */
let _aiAcct=null,_aiAcctBusy=false,_aiAutoTried=false,_aiVoiceList=[],_aiVoiceQ='',_aiVoiceTestBusy=false,_aiVoiceTestStatus='',_aiPayBusy=false,_aiClaimFile=null,_aiClaimBusy=false,_aiImageBusy=false,_aiImageStatus='',_aiImageResult='',_aiLowBalanceTimer=0;
const AI_VOICE_PRESETS=[
  {id:'phonevoice20260709b',name:'月岛萤',clone:true,preset:true},
  {id:'phonevoice20260709a',name:'御叔',clone:true,preset:true}
];
const AI_DEFAULT_TTS_VOICE='male-qn-qingse';
const AI_RECHARGE_FALLBACK=[
  {id:'p_990',name:'轻量体验',amount_cny:9.9,points:250,tag:'初次尝试'},
  {id:'p_2990',name:'日常畅聊',amount_cny:29.9,points:850,tag:'推荐'},
  {id:'p_5990',name:'深度陪伴',amount_cny:59.9,points:1800,tag:'更耐用'},
  {id:'p_9990',name:'长期相伴',amount_cny:99.9,points:3200,tag:'单点更省'},
  {id:'svc_clone_1990',name:'快速音色克隆',amount_cny:19.9,points:0,kind:'service',tag:'一次性服务'}
];
const AI_PAYMENT_CHANNELS=[
  {id:'alipay',name:'支付宝',qr:'./pay-assets/alipay-receive.jpg',url:'https://qr.alipay.com/fkx10690k51wzfzjiusi25e'},
  {id:'wechat',name:'微信支付',qr:'./pay-assets/wechat-receive.jpg',url:''}
];
const AI_CLONE_CONTACT_QR='./pay-assets/wechat-contact.jpg';
const AI_PURCHASE_NOTICE='生图API原生成功率约50%，单次扣费0.3元，算上失败重试和平台手续费，一张合格成品实际成本0.62-0.79元（已经尽力压低成本，原先每张成本在1元以上），定价统一按1元/张收取。定价不含人工辛苦费，全程自愿消费，没有强制消费。即便用户生成依旧失败，在接口已经扣费的情况下，你（用户）这边，会返还点数。本服务优势是出图稳定、出图速度较快；如果觉得不合适，大家可以自行去API站点购买接口。本系统只适合自己用的接口不稳定、花费更高的人使用。点数请按需购买，少量多次。购买点数之后不要更换浏览器，更换浏览器会导致点数消失！！！请将点数用完之后再换浏览器，如因换浏览器或手机而导致点数消失概不负责。';
function aiPageScroll(){const sc=typeof $==='function'?$('.scroll'):null;return sc?sc.scrollTop:0;}
function aiRenderStable(){const top=aiPageScroll(),page=typeof $==='function'?$('#app .page'):null;if(page&&typeof cur==='function'&&cur().p==='aiaccount')page.innerHTML=renderAIAccount();else render();requestAnimationFrame(()=>{const n=typeof $==='function'?$('.scroll'):null;if(n)n.scrollTop=top;});}
function aiHiddenPurchases(){const ac=aiCoreInit();if(!Array.isArray(ac.hiddenPurchases))ac.hiddenPurchases=[];return ac.hiddenPurchases;}
function aiVisiblePurchases(){const hidden=new Set(aiHiddenPurchases().map(String));return (_aiAcct&&Array.isArray(_aiAcct.purchases)?_aiAcct.purchases:[]).filter(x=>!hidden.has(String(x&&x.id||'')));}
function aiHidePurchase(id){if(!id)return;const arr=aiHiddenPurchases(),sid=String(id);if(!arr.map(String).includes(sid))arr.unshift(sid);aiCoreInit().hiddenPurchases=arr.slice(0,80);save();aiRenderStable();toast('订单已从本机列表移除');}
function aiShowPurchaseNotice(){openModal(`<h3>购买说明</h3><div style="border:1px solid rgba(255,91,111,.5);background:#271419;color:#ff9aa8;border-radius:10px;padding:12px 13px;font-size:13px;line-height:1.8;white-space:pre-wrap">${esc(AI_PURCHASE_NOTICE)}</div><button class="btn g" style="margin-top:10px" onclick="closeModal()">关闭</button>`);}
function aiMergeVoicePresets(list){const out=Array.isArray(list)?list.slice():[],seen=new Set(out.map(v=>String(v&&v.id||'')));AI_VOICE_PRESETS.forEach(v=>{if(!seen.has(v.id))out.unshift(v);});return out;}

function openAIAccount(){go('aiaccount');}
function aiCoreInit(){S.settings.aiCore=S.settings.aiCore||{enabled:false,url:GATE_URL+'/functions/v1/phone-ai'};S.settings.aiCore.enabled=false;if(!S.settings.aiCore.url)S.settings.aiCore.url=GATE_URL+'/functions/v1/phone-ai';return S.settings.aiCore;}
function aiLowBalanceCfg(){const ac=aiCoreInit();if(typeof ac.lowBalanceAlertOn!=='boolean')ac.lowBalanceAlertOn=true;let n=Number(ac.lowBalanceThreshold);if(!Number.isFinite(n))n=20;ac.lowBalanceThreshold=Math.max(1,Math.min(99999,Math.round(n)));return ac;}
function aiToggleLowBalance(){const ac=aiLowBalanceCfg();ac.lowBalanceAlertOn=!ac.lowBalanceAlertOn;ac.lowBalanceAlerted=false;save();aiRenderStable();toast(ac.lowBalanceAlertOn?'点数提醒已开启':'点数提醒已关闭');}
function aiSetLowBalance(v){const ac=aiLowBalanceCfg(),n=Math.max(1,Math.min(99999,Math.round(Number(v)||20)));ac.lowBalanceThreshold=n;ac.lowBalanceAlerted=false;save();aiRenderStable();const balance=_aiAcct&&_aiAcct.account&&Number(_aiAcct.account.points);if(Number.isFinite(balance))aiCheckLowBalance(balance);toast('低于 '+n+' 点时提醒');}
function aiShowLowBalance(balance,tries){const modal=typeof $==='function'&&$('#modal');if(modal&&modal.classList.contains('show')&&tries<4){_aiLowBalanceTimer=setTimeout(()=>aiShowLowBalance(balance,tries+1),1200);return;}if(modal&&modal.classList.contains('show')){toast('AI点数快用完了，当前剩余 '+balance+' 点');return;}openModal(`<h3>AI点数快用完了</h3><div class="hint">当前剩余 <b style="color:#ffb7d2">${balance}</b> 点。可以先查看最近流水，按需少量充值，避免语音或图片生成中断。</div><button class="btn p" style="margin-top:12px" onclick="closeModal();go('aiaccount')">查看AI账户</button><button class="btn g" style="margin-top:8px" onclick="closeModal()">稍后再说</button>`);}
function aiCheckLowBalance(balance){const ac=aiLowBalanceCfg(),n=Number(balance),limit=ac.lowBalanceThreshold;if(!Number.isFinite(n)||!ac.lowBalanceAlertOn)return;if(n>=limit){if(ac.lowBalanceAlerted){ac.lowBalanceAlerted=false;save();}return;}if(ac.lowBalanceAlerted)return;ac.lowBalanceAlerted=true;save();clearTimeout(_aiLowBalanceTimer);_aiLowBalanceTimer=setTimeout(()=>aiShowLowBalance(n,0),350);}
function aiVoiceEnabled(){return typeof ttsEnabled==='function'?ttsEnabled(S.settings.tts||{}):!!((S.settings.tts||{}).enabled);}
function aiVoiceRelayOn(){return !!((S.settings.tts||{}).relay&&aiCoreUrl());}
function aiImageReady(){return !_aiAcct||!_aiAcct.capabilities?null:_aiAcct.capabilities.image!==false;}
function aiExternalTts(){const t=(typeof ttsCfg==='function'?ttsCfg():(S.settings.tts||{}));return t&&t.base&&t.key?t:null;}
function aiPrice(k){const p=(_aiAcct&&_aiAcct.pricing)||{chat:10,vision:25,image:20,tts:10,summary:2};return p[k]||0;}
function aiLedgerTime(v){if(!v)return '';const d=new Date(v);if(isNaN(d))return String(v).replace('T',' ').slice(0,16);return d.toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});}
function aiLedgerRows(){const rows=((_aiAcct&&_aiAcct.ledger)||[]).slice().sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)),names={chat:'聊天',vision:'识图',image:'生图',tts:'语音',summary:'总结',manual:'手动加点',free:'赠送'};return rows.length?rows.map(x=>{const meta=x.meta||{},failed=x.status==='failed',billed=failed&&(meta.charged||x.billed),title=(names[x.feature]||x.feature)+(failed?(billed?' · 失败已计费':' · 失败未计费'):'');const note=meta.note||x.note||(failed?(meta.reason||'模型返回失败'):'');return `<div class="bill"><div><b>${esc(title)}</b><small>${esc(aiLedgerTime(x.created_at))}${note?' · '+esc(String(note).slice(0,80)):''}</small></div><div class="${x.points>=0?'pos':'neg'}">${x.points>0?'+':''}${x.points}</div></div>`;}).join(''):'<div class="empty">还没有流水</div>';}
function aiRechargePlans(){return _aiAcct&&Array.isArray(_aiAcct.plans)&&_aiAcct.plans.length?_aiAcct.plans:AI_RECHARGE_FALLBACK;}
function aiPlanById(id){return aiRechargePlans().find(x=>String(x.id)===String(id));}
function aiPaymentChannel(id){return AI_PAYMENT_CHANNELS.find(x=>x.id===id);}
function aiPurchaseIsService(x){return Number(x&&x.points||0)===0&&Math.abs(Number(x&&x.amount_cny||0)-19.9)<.01;}
function aiPurchaseRows(){const rows=aiVisiblePurchases().slice(0,20);
  return rows.length?rows.map(x=>{const service=aiPurchaseIsService(x),review=String(x.review_status||'unsubmitted');let label=x.status==='paid'?'已确认到账':x.status==='refunded'?'已退款':x.status==='cancelled'?(review==='rejected'?'未通过核对':'已取消'):(review==='submitted'?'等待人工核对':'等待上传凭证');const action=x.status==='pending'&&review!=='submitted'?`<button class="minibtn" style="margin-top:6px" onclick="aiOpenPurchaseClaim('${esc(x.id)}')">上传截图</button>`:'';return `<div class="bill"><div style="flex:1;min-width:0"><b>${esc(label)} · ${esc(x.provider==='wechat'?'微信':'支付宝')}</b><small>${esc(aiLedgerTime(x.created_at))} · 订单 ${esc(String(x.id||'').slice(0,8).toUpperCase())}</small>${x.review_note?`<small style="color:#e7a0a8">${esc(x.review_note)}</small>`:''}${action}</div><div style="display:flex;align-items:center;gap:8px"><div class="${x.status==='paid'?'pos':''}" style="white-space:nowrap">${service?'音色克隆':Number(x.points||0).toLocaleString()+'点'}</div><button class="minibtn" style="width:28px;height:28px;padding:0;border-radius:50%;font-size:15px;color:#c8cbd2;background:#2a2c33" onclick="aiHidePurchase('${esc(x.id)}')" title="从本机列表删除">×</button></div></div>`;}).join(''):'<div class="hint" style="padding:0 14px 12px">还没有充值或服务订单</div>';}
function aiRechargeCards(){return aiRechargePlans().filter(p=>p.kind!=='service').map((p,i)=>`<button onclick="aiOpenRecharge('${esc(p.id)}')" style="min-width:0;text-align:left;border:1px solid ${i===1?'rgba(255,183,210,.7)':'rgba(255,255,255,.1)'};background:${i===1?'#24212a':'#1c1d22'};color:#f5f5f7;border-radius:8px;padding:13px 12px;cursor:pointer">
    <span style="display:block;font-size:12px;color:${i===1?'#ffb7d2':'#9297a1'}">${esc(p.tag||p.name||'充值套餐')}</span>
    <b style="display:block;font-size:23px;margin:5px 0 2px;letter-spacing:0">${Number(p.points||0).toLocaleString()}<small style="font-size:12px;font-weight:500;color:#a8adb6;margin-left:3px">点</small></b>
    <span style="font-size:14px;color:#e1e2e6">¥${Number(p.amount_cny||0).toFixed(1)}</span>
    <small style="display:block;color:#747985;margin-top:5px">约 ${Math.floor(Number(p.points||0)/Math.max(1,aiPrice('tts')))} 条普通语音</small>
  </button>`).join('');}
function aiImagePackageCards(){return aiRechargePlans().filter(p=>p.kind!=='service').map((p,i)=>`<button onclick="aiOpenRecharge('${esc(p.id)}')" style="min-width:0;text-align:left;border:1px solid ${i===1?'rgba(126,184,255,.68)':'rgba(255,255,255,.1)'};background:${i===1?'#1d2632':'#1c1d22'};color:#f5f5f7;border-radius:8px;padding:13px 12px;cursor:pointer">
    <span style="display:block;font-size:12px;color:${i===1?'#9dc7ff':'#9297a1'}">${esc(p.tag||p.name||'图片套餐')}</span>
    <b style="display:block;font-size:23px;margin:5px 0 2px;letter-spacing:0">${Math.floor(Number(p.points||0)/Math.max(1,aiPrice('image')))}<small style="font-size:12px;font-weight:500;color:#a8adb6;margin-left:3px">张</small></b>
    <span style="font-size:14px;color:#e1e2e6">¥${Number(p.amount_cny||0).toFixed(1)}</span>
    <small style="display:block;color:#747985;margin-top:5px">${Number(p.points||0).toLocaleString()} 点通用点数</small>
  </button>`).join('');}
function aiServiceCards(){return aiRechargePlans().filter(p=>p.kind==='service').map(p=>`<button onclick="aiOpenRecharge('${esc(p.id)}')" style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;border:1px solid rgba(255,255,255,.12);background:#1c1d22;color:#f5f5f7;border-radius:8px;padding:14px;cursor:pointer">
    <span><b style="display:block;font-size:16px">${esc(p.name)}</b><small style="display:block;color:#8f949d;margin-top:5px">一次克隆、试听并接入小手机</small></span>
    <b style="font-size:20px;white-space:nowrap">¥${Number(p.amount_cny||0).toFixed(1)}</b>
  </button>`).join('');}

function renderAIAccount(){const ac=aiCoreInit();const id=aiUserId();S.settings.tts=S.settings.tts||{};const tts=S.settings.tts;setTimeout(()=>{if(cur().p==='aiaccount'&&!_aiAcct&&!_aiAcctBusy&&!_aiAutoTried)aiAccountRefresh(true,true);},80);
  const bal=_aiAcct&&_aiAcct.account?(_aiAcct.account.points||0):'--';
  const low=aiLowBalanceCfg();
  const voice=(tts.voice)||'未选择';
  return `<div class="nav"><span class="l" onclick="back()">‹</span><span class="t">AI账户</span><span class="r" onclick="aiAccountRefresh()">刷新</span></div>
  <div class="scroll" style="background:#0f1117;color:#e8eaf0;padding:12px">
    <div style="background:#17191f;border-radius:8px;padding:18px 16px;margin-bottom:12px;border:1px solid rgba(255,255,255,.12);box-shadow:0 10px 28px rgba(0,0,0,.2)">
      <div style="font-size:12px;color:#aeb4bf">小手机内置AI点数</div>
      <div style="font-size:38px;font-weight:700;margin:6px 0">${bal}</div>
      <div style="font-size:12px;color:#cbd5e1;word-break:break-all">用户ID：${esc(id)} <button class="minibtn" onclick="aiCopyId()" style="margin-left:6px">复制</button></div>
    </div>
    <button onclick="showManual('ai')" style="width:100%;margin:0 0 12px;padding:11px 12px;border:1px solid rgba(165,180,252,.3);background:#171a24;color:#cdd5ff;border-radius:8px;font-size:13px;text-align:left;cursor:pointer;display:flex;align-items:center;justify-content:space-between"><span>AI账户使用说明与常见问题</span><b style="font-size:16px">›</b></button>
    <div class="section">
      <div class="it"><span>点数不足提醒<br><small style="color:#888">余额低于设定值时在小手机屏幕弹窗提醒</small></span><span class="sw ${low.lowBalanceAlertOn?'on':''}" onclick="aiToggleLowBalance()"></span></div>
      <div class="it"><span>提醒额度</span><span class="v"><input type="number" min="1" max="99999" inputmode="numeric" value="${low.lowBalanceThreshold}" onchange="aiSetLowBalance(this.value)" style="width:82px;text-align:right"> 点</span></div>
    </div>
    <div style="display:flex;align-items:end;justify-content:space-between;padding:5px 2px 9px">
      <div><b style="font-size:17px">充值点数</b><small style="display:block;color:#777;margin-top:3px">付款后按订单核对到账</small></div>
      <button class="minibtn" onclick="aiAccountRefresh()">刷新到账</button>
    </div>
    <button onclick="aiShowPurchaseNotice()" style="width:100%;margin:0 0 10px;padding:11px 12px;border:1px solid rgba(255,91,111,.36);background:#23151a;color:#ff8fa0;border-radius:8px;font-size:13px;text-align:left;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:10px"><span style="display:flex;align-items:center;gap:8px">${typeof svgIc==='function'?svgIc('book',18,'#ff8fa0',1.6):''}购买与生图扣费说明</span><b style="font-size:16px">›</b></button>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:12px">${aiRechargeCards()}</div>
    <div style="padding:5px 2px 9px"><b style="font-size:17px">音色服务</b><small style="display:block;color:#777;margin-top:3px">请确认拥有声音授权，再提交干净音频</small></div>
    <div style="margin-bottom:12px">${aiServiceCards()}</div>
    <div class="section">
      <div style="padding:12px 14px;font-weight:600;color:#d8dbe2">充值与服务订单</div>
      ${aiPurchaseRows()}
    </div>
    <div class="section">
      <div class="it"><span>内置语音<br><small style="color:#888">开：角色语音条和语音电话走部署后台；关：若设置里填了外置海螺，则走外置海螺。</small></span><span class="sw ${aiVoiceRelayOn()?'on':''}" onclick="aiToggleVoiceApi()"></span></div>
    </div>
    <div class="section">
      <div class="it"><span>启用图片生成<br><small style="color:${aiImageReady()===false?'#e6a0a8':'#888'}">${aiImageReady()===false?'图片中转站尚未配置，暂时不能开启。':'使用已部署的 gpt-image-2 中转站，每张 '+aiPrice('image')+' 点；生成失败自动退点。'}</small></span><span class="sw ${aiImageRelayOn()?'on':''}" onclick="aiToggleImageApi()"></span></div>
      <div class="btns" style="padding:0 14px 12px"><button class="btn p" ${_aiImageBusy?'disabled':''} onclick="aiOpenImageGenerator()">${_aiImageBusy?'生成中…':'生成一张图片'}</button></div>
      ${_aiImageStatus?`<div class="hint" style="padding:0 14px 10px;color:${_aiImageBusy?'#9dc7ff':'#9aa0aa'}">${esc(_aiImageStatus)}</div>`:''}
      ${_aiImageResult?`<div style="padding:0 14px 14px"><img src="${esc(_aiImageResult)}" alt="生成的图片" onclick="viewImg(this.src)" style="display:block;width:100%;max-height:46vh;object-fit:contain;background:#111;border:1px solid rgba(255,255,255,.1);border-radius:8px"></div>`:''}
    </div>
    <div style="padding:5px 2px 9px"><b style="font-size:17px">图片生成套餐</b><small style="display:block;color:#777;margin-top:3px">套餐购买的是通用点数，按每张 ${aiPrice('image')} 点估算；文字、语音也可以使用同一余额。</small></div>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:12px">${aiImagePackageCards()}</div>
    <div class="section">
      <div style="padding:12px 14px;font-weight:600;color:#a5b4fc">语音音色</div>
      <div class="hint" style="padding:0 14px 8px">选中的音色会作为小手机默认语音音色。</div>
      <div class="it"><span>默认音色<small>${esc(voice)}</small></span><span class="v"><button class="minibtn" onclick="aiPullVoices()">拉取音色</button></span></div>
      <div class="btns" style="padding:0 14px 6px"><button class="btn g" onclick="aiClearVoice()">清空音色</button><button class="btn p" ${_aiVoiceTestBusy?'disabled':''} onclick="aiTestVoice()">${_aiVoiceTestBusy?'生成中…':'测试语音'}</button></div>
      ${_aiVoiceTestBusy||_aiVoiceTestStatus?`<div class="hint" style="padding:0 14px 10px;color:${_aiVoiceTestBusy?'#ffb7d2':'#9aa0aa'}">${_aiVoiceTestBusy?'<span class="spin" style="display:inline-block;width:12px;height:12px;border:2px solid rgba(255,255,255,.25);border-top-color:#ff8fab;border-radius:50%;animation:aispin .8s linear infinite;vertical-align:-2px;margin-right:6px"></span>':''}${esc(_aiVoiceTestStatus||'语音生成中，请稍等，不要重复点击')}</div>`:''}
    </div>
    <div class="section">
      <div style="padding:12px 14px;font-weight:600;color:#a5b4fc">最近流水<small style="display:block;color:#777;font-weight:400;margin-top:3px">按本地时间显示，最多保留80条</small></div>
      <div id="ai_ledger">${aiLedgerRows()}</div>
    </div>
    <div class="hint">个人收款码暂不支持自动支付回调。付款后上传付款截图；管理员核对真实账单并确认后，点数才会进入本账户。</div>
  </div>`;}

function aiOpenRecharge(planId){const p=aiPlanById(planId);if(!p)return;
  openModal(`<h3>${esc(p.name||'充值点数')}</h3>
    <div style="text-align:center;padding:6px 0 14px"><b style="font-size:30px">${p.kind==='service'?'1 个音色':Number(p.points||0).toLocaleString()+'点'}</b><div style="color:#999;margin-top:4px">应付 ¥${Number(p.amount_cny||0).toFixed(1)}</div></div>
    <div class="hint">${p.kind==='service'?'包含一次快速克隆、试听和接入小手机。付款后添加微信，发送订单号、已获授权的干净音频和角色名称。':'选择付款方式后会创建专属订单，并尝试打开对应收款页。付款金额必须与套餐一致。'}</div>
    ${p.kind==='service'?'':`<button onclick="aiShowPurchaseNotice()" style="width:100%;margin-top:10px;padding:10px 11px;border:1px solid rgba(255,91,111,.36);background:#23151a;color:#ff8fa0;border-radius:8px;font-size:13px;text-align:left;cursor:pointer;display:flex;align-items:center;justify-content:space-between"><span>购买与生图扣费说明</span><b>›</b></button>`}
    <div class="btns" style="margin-top:12px">
      <button class="btn" style="background:#1677ff;color:#fff" ${_aiPayBusy?'disabled':''} onclick="aiCreatePurchase('${esc(p.id)}','alipay')">支付宝</button>
      <button class="btn" style="background:#07c160;color:#fff" ${_aiPayBusy?'disabled':''} onclick="aiCreatePurchase('${esc(p.id)}','wechat')">微信支付</button>
    </div>
    <button class="btn g" style="margin-top:10px" onclick="closeModal()">暂不充值</button>`);}

async function aiCreatePurchase(planId,provider){if(_aiPayBusy)return;const p=aiPlanById(planId),channel=aiPaymentChannel(provider);if(!p||!channel)return;_aiPayBusy=true;
  try{const d=await aiRelay('purchase_create',{plan_id:planId,provider});if(!_aiAcct)_aiAcct={};if(d.purchase){_aiAcct.purchases=_aiAcct.purchases||[];_aiAcct.purchases.unshift(d.purchase);_aiAcct.purchases=_aiAcct.purchases.slice(0,12);}aiShowPayment(d.purchase,p,d.payment_note,channel);setTimeout(()=>aiLaunchPayment(provider,true),550);}
  catch(e){toast('创建订单失败：'+String((e&&e.message)||e).replace(/^内置AI失败：/,''));}
  finally{_aiPayBusy=false;}}

function aiShowPayment(purchase,plan,note,channel){if(!purchase||!plan||!channel)return;const oid=String(purchase.id||'');
  openModal(`<h3>${esc(channel.name)}收款码</h3>
    <div style="text-align:center;color:#999;font-size:13px;margin-bottom:8px">支付 ¥${Number(plan.amount_cny||0).toFixed(1)} · ${plan.kind==='service'?'快速音色克隆 1 个':'到账 '+Number(plan.points||0).toLocaleString()+'点'}</div>
    <img src="${esc(channel.qr)}" alt="${esc(channel.name)}收款码" onclick="viewImg('${esc(channel.qr)}')" style="display:block;width:min(72vw,280px);max-height:44vh;object-fit:contain;margin:0 auto;border-radius:8px;background:#fff">
    <div style="margin:12px 0 0;border:1px solid rgba(255,91,111,.55);background:#2a151b;color:#ff9aa8;border-radius:8px;padding:9px 11px;font-size:13px;line-height:1.6">付款完成后一定要回到这里上传付款截图，并填写付款昵称/尾号和付款时间。没有截图不会进入后台核对，也不会自动加点。</div>
    <div style="margin:12px 0;background:#202126;border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:10px 12px;color:#ddd;font-size:13px;line-height:1.7">
      订单号：<b>${esc(oid.slice(0,8).toUpperCase())}</b><br>付款备注：<b>${esc(note||'')}</b><br>
      <small style="color:#888">${plan.kind==='service'?'付款后上传付款截图，再添加微信发送订单号和音频。':'付款后上传付款截图，等待管理员核对真实账单。'}</small>
    </div>
    ${plan.kind==='service'?'':`<button onclick="aiShowPurchaseNotice()" style="width:100%;margin:0 0 12px;padding:10px 11px;border:1px solid rgba(255,91,111,.36);background:#23151a;color:#ff8fa0;border-radius:8px;font-size:13px;text-align:left;cursor:pointer;display:flex;align-items:center;justify-content:space-between"><span>购买与生图扣费说明</span><b>›</b></button>`}
    <div class="btns"><button class="btn g" onclick="aiCopyPayment('${esc(note||oid)}')">复制备注</button><button class="btn p" onclick="aiLaunchPayment('${esc(channel.id)}')">打开${esc(channel.name)}</button></div>
    ${plan.kind==='service'?`<button class="btn p" style="margin-top:10px;background:#3a3d46" onclick="aiShowCloneContact('${esc(note||oid)}')">添加微信办理</button>`:''}
    <button class="btn g" style="margin-top:10px" onclick="aiOpenPurchaseClaim('${esc(oid)}')">上传付款截图，提交核对</button>`);}

function aiClaimPurchase(id){return _aiAcct&&Array.isArray(_aiAcct.purchases)?_aiAcct.purchases.find(x=>String(x.id)===String(id)):null;}
function aiClaimLocalTime(){const d=new Date(),pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;}
function aiOpenPurchaseClaim(purchaseId){const p=aiClaimPurchase(purchaseId);if(!p){toast('订单信息已过期，请先刷新 AI 账户');return;}_aiClaimFile=null;openModal(`<h3>提交付款核对</h3>
  <div class="hint" style="margin-bottom:10px">订单 ${esc(String(p.id||'').slice(0,8).toUpperCase())} · ${p.provider==='wechat'?'微信':'支付宝'} ¥${Number(p.amount_cny||0).toFixed(2)}<br>请上传本订单的真实付款截图。截图只用于申请核对，不代表已经到账；管理员仍会核对收款账单。</div>
  <label class="field" style="display:block"><span>付款截图</span><input id="ai_claim_file" type="file" accept="image/jpeg,image/png,image/webp" onchange="aiClaimPick(this)"></label>
  <div id="ai_claim_preview" style="display:none;margin:8px 0;text-align:center"></div>
  <label class="field" style="display:block"><span>付款账号昵称或尾号（必填）</span><input id="ai_claim_hint" maxlength="80" placeholder="必须填写，方便在账单里核对"></label>
  <label class="field" style="display:block"><span>付款时间</span><input id="ai_claim_time" type="datetime-local" value="${esc(aiClaimLocalTime())}"></label>
  <button class="btn p" id="ai_claim_submit" style="margin-top:10px" onclick="aiSubmitPurchaseClaim('${esc(p.id)}')">提交给管理员核对</button>
  <button class="btn g" style="margin-top:8px" onclick="closeModal()">取消</button>`);}
function aiClaimPick(input){const file=input&&input.files&&input.files[0];if(!file)return;const ok=/^image\/(jpeg|png|webp)$/i.test(file.type||'');if(!ok){input.value='';toast('请上传 JPG、PNG 或 WebP 图片');return;}if(file.size>12*1024*1024){input.value='';toast('原图不能超过 12MB');return;}_aiClaimFile=file;const box=document.getElementById('ai_claim_preview'),url=URL.createObjectURL(file);if(box){box.style.display='block';box.innerHTML=`<img src="${url}" alt="付款截图预览" style="max-width:100%;max-height:34vh;object-fit:contain;border-radius:8px">`;setTimeout(()=>URL.revokeObjectURL(url),30000);}}
async function aiClaimImageData(file){return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('读取截图失败'));reader.onload=()=>{const img=new Image();img.onerror=()=>reject(new Error('截图格式无法读取'));img.onload=()=>{let w=img.naturalWidth||img.width,h=img.naturalHeight||img.height,scale=Math.min(1,1600/Math.max(w,h));w=Math.max(1,Math.round(w*scale));h=Math.max(1,Math.round(h*scale));const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,w,h);let data=canvas.toDataURL('image/jpeg',.82);if(data.length>2.65*1024*1024)data=canvas.toDataURL('image/jpeg',.68);if(data.length>2.8*1024*1024){reject(new Error('截图压缩后仍过大，请裁剪后重试'));return;}resolve(data);};img.src=String(reader.result||'');};reader.readAsDataURL(file);});}
async function aiSubmitPurchaseClaim(purchaseId){if(_aiClaimBusy)return;const btn=document.getElementById('ai_claim_submit'),hint=document.getElementById('ai_claim_hint'),time=document.getElementById('ai_claim_time'),payer=(hint&&hint.value||'').trim(),paidAt=(time&&time.value||'').trim();if(!_aiClaimFile){toast('请先选择付款截图');return;}if(payer.length<2){toast('请填写付款昵称或付款尾号');if(hint)hint.focus();return;}if(!paidAt){toast('请填写付款时间');if(time)time.focus();return;}_aiClaimBusy=true;if(btn){btn.disabled=true;btn.textContent='正在安全上传…';}
  try{const proof=await aiClaimImageData(_aiClaimFile);const d=await aiRelay('purchase_submit',{purchase_id:purchaseId,proof_image:proof,payer_hint:payer,claimed_paid_at:paidAt});if(!_aiAcct)_aiAcct={};_aiAcct.purchases=_aiAcct.purchases||[];const i=_aiAcct.purchases.findIndex(x=>String(x.id)===String(purchaseId));if(i>=0)_aiAcct.purchases[i]=Object.assign({},_aiAcct.purchases[i],d.purchase||{},{review_status:'submitted'});closeModal();render();toast('已提交，管理员核对后会自动到账');}
  catch(e){toast('提交失败：'+String((e&&e.message)||e).replace(/^内置AI失败：/,''));}
  finally{_aiClaimBusy=false;if(btn){btn.disabled=false;btn.textContent='提交给管理员核对';}}}

function aiShowCloneContact(note){openModal(`<h3>添加微信办理音色克隆</h3>
  <div class="hint" style="margin-bottom:10px">添加后请发送：<b>${esc(note||'克隆订单号')}</b>、已获授权的干净音频、角色名称。请勿提交未经本人许可的真人声音。</div>
  <img src="${esc(AI_CLONE_CONTACT_QR)}" alt="音色克隆联系方式" onclick="viewImg('${esc(AI_CLONE_CONTACT_QR)}')" style="display:block;width:min(76vw,300px);max-height:58vh;object-fit:contain;margin:0 auto;border-radius:8px;background:#fff">
  <div class="btns" style="margin-top:12px"><button class="btn g" onclick="aiCopyPayment('${esc(note||'')}')">复制订单号</button><button class="btn p" onclick="viewImg('${esc(AI_CLONE_CONTACT_QR)}')">查看大图</button></div>
  <button class="btn g" style="margin-top:10px" onclick="closeModal()">关闭</button>`);}

function aiCopyPayment(text){try{navigator.clipboard&&navigator.clipboard.writeText(text);}catch(_){}toast('已复制付款备注');}
function aiLaunchPayment(provider,automatic){const c=aiPaymentChannel(provider);if(!c)return;if(!c.url){if(!automatic)toast('请长按保存收款码，付款后上传截图核对');return;}if(!automatic)toast('正在打开'+c.name+'…');try{window.open(c.url,'_blank','noopener');}catch(_){try{location.href=c.url;}catch(__){if(!automatic)toast('没有自动打开，请长按保存收款码后扫码');}}}

function aiToggleCore(){const ac=aiCoreInit();ac.enabled=false;save();aiRenderStable();toast('内置 AI 主通道已固定关闭');}
function aiToggleVoiceApi(){S.settings.tts=S.settings.tts||{};S.settings.tts.relay=!aiVoiceRelayOn();if(S.settings.tts.relay)S.settings.tts.enabled=true;save();aiRenderStable();toast(S.settings.tts.relay?'内置语音已开启':'内置语音已关闭');}
function aiToggleImageApi(){if(aiImageReady()===false){toast('图片中转站尚未配置，暂时不能开启');return;}const cfg=aiImageInit();cfg.enabled=!aiImageRelayOn();save();aiRenderStable();toast(cfg.enabled?'图片生成已开启':'图片生成已关闭');}
function aiImageFailText(e){const full=String((e&&e.message)||e||'').replace(/^内置AI失败：/,'');const raw=full.slice(0,180);if(/429|No images were successfully|relay-image-empty|no image/i.test(full))return '中转站上游这次没有成功出图或正在限流排队；后台花费为0时不会扣真实费用，本次AI点数已退回。稍后再试，或把描述写短一点。';if(/upstream-timeout|timeout|timed out|aborted/i.test(full))return '中转站生成超时，通常不是密钥错误；本次点数已退回，可以稍后换短一点的描述再试。';if(/fetch|network|load failed|cors/i.test(full))return '网络等待太久断开；如果后台显示429/花费0，说明是中转站上游没有成功出图，不是密钥或付款问题。';if(/401|403|unauthori|forbidden|invalid.*key|no access/i.test(full))return '中转站密钥或权限异常，本次点数已退回。';if(/404|model.*not.*found|not found/i.test(full))return '接口地址或图片模型不匹配，本次点数已退回。';return raw||'图片生成失败，本次点数已退回。';}
function aiOpenImageGenerator(){if(aiImageReady()===false){toast('图片中转站尚未配置');return;}if(!aiImageRelayOn()){toast('请先打开「启用图片生成」');return;}if(_aiImageBusy){toast('上一张图片还在生成中');return;}
  openModal(`<h3>图片生成</h3>
    <div class="hint" style="margin-bottom:10px">gpt-image-2 中转站 · 每张 ${aiPrice('image')} 点。生成失败自动退点。</div>
    <label class="field" style="display:block"><span>想生成什么</span><textarea id="ai_image_prompt" maxlength="1000" rows="5" placeholder="例如：夜晚窗边的一杯热可可，真实手机随手拍，暖色灯光"></textarea></label>
    <label class="field" style="display:block"><span>图片比例</span><select id="ai_image_size"><option value="1024x1024">方形</option><option value="1024x1536">竖图</option><option value="1536x1024">横图</option></select></label>
    <button class="btn p" style="margin-top:10px" onclick="aiGenerateAccountImage()">生成图片 · ${aiPrice('image')}点</button>
    <button class="btn g" style="margin-top:8px" onclick="closeModal()">取消</button>`);}
async function aiGenerateAccountImage(){if(_aiImageBusy)return;if(!aiImageRelayOn()){toast('图片生成没有开启');return;}const prompt=(document.getElementById('ai_image_prompt')&&document.getElementById('ai_image_prompt').value||'').trim(),size=(document.getElementById('ai_image_size')&&document.getElementById('ai_image_size').value)||'1024x1024';if(!prompt){toast('先写图片内容');return;}
  _aiImageBusy=true;_aiImageStatus='正在调用图片中转站，请稍等…';_aiImageResult='';closeModal();if(cur().p==='aiaccount')aiRenderStable();
  try{const d=await aiRelay('image',{prompt,size}),it=d&&d.data&&d.data.data&&d.data.data[0],raw=it&&(it.url||(it.b64_json?('data:image/jpeg;base64,'+it.b64_json):''));if(!raw)throw new Error('图片中转站没有返回图片');_aiImageResult=typeof stableImageSrc==='function'?await stableImageSrc(raw):raw;_aiImageStatus='图片生成成功，已扣除 '+Number(d.charged||aiPrice('image'))+' 点';toast('图片生成成功');}
  catch(e){const refunded=e&&e.data&&Number(e.data.refunded||0),msg=aiImageFailText(e);_aiImageStatus='生成失败'+(refunded?'，已退回 '+refunded+' 点':'')+'：'+msg;toast(refunded?'生成失败，点数已退回':'图片生成失败');}
  finally{_aiImageBusy=false;setTimeout(()=>aiAccountRefresh(true,true),500);if(cur().p==='aiaccount')aiRenderStable();}}
function aiCopyId(){try{navigator.clipboard&&navigator.clipboard.writeText(aiUserId());}catch(_){}toast('已复制用户ID');}

async function aiPullVoices(){toast('正在拉取音色…');
  try{const ext=aiExternalTts();
    if(!aiVoiceRelayOn()&&ext&&/minimax/i.test(ext.base||'')){
      const base=(ext.base||'').replace(/\/+$/,'');
      const gid=(ext.group||'').trim(),url=base+'/v1/get_voice'+(gid?('?GroupId='+encodeURIComponent(gid)):'');
      const r=await fetch(url,{method:'POST',headers:{'Authorization':'Bearer '+ext.key,'Content-Type':'application/json'},body:JSON.stringify({voice_type:'all'})});
      const d=await r.json().catch(()=>null);
      if(!d||(d.base_resp&&d.base_resp.status_code!==0)){toast('拉取失败：'+((d&&d.base_resp&&d.base_resp.status_msg)||r.status));return;}
      const clones=(d.voice_cloning||[]).map(v=>({id:v.voice_id,name:v.voice_name||'我的克隆',clone:true}));
      const sys=(d.system_voice||[]).map(v=>({id:v.voice_id,name:v.voice_name||v.voice_id}));
      _aiVoiceList=aiMergeVoicePresets(clones.concat(sys));_aiVoiceQ='';
      if(!_aiVoiceList.length){toast('没有拉到音色，检查 MiniMax Key / GroupId');return;}
      aiShowVoicePicker();return;
    }
    const d=await aiRelay('tts_voices',{});_aiVoiceList=aiMergeVoicePresets((d&&d.voices)||[]);_aiVoiceQ='';
    if(!_aiVoiceList.length){toast('没有拉到音色，检查 MiniMax Key / GroupId');return;}
    aiShowVoicePicker();
  }catch(e){toast('拉取失败：'+String((e&&e.message)||e).replace(/^内置AI失败：/,''));}}
function aiShowVoicePicker(){const q=(_aiVoiceQ||'').toLowerCase(),curVoice=((S.settings.tts||{}).voice)||'';
  const list=_aiVoiceList.filter(v=>!q||String(v.id||'').toLowerCase().includes(q)||String(v.name||'').toLowerCase().includes(q));
  openModal(`<h3>选择默认语音</h3>
    <div class="hint">当前默认：${esc(curVoice||'未选择')}</div>
    <div class="field"><input id="ai_vq" placeholder="搜名字或ID" value="${esc(_aiVoiceQ)}" oninput="_aiVoiceQ=this.value;aiShowVoicePicker();setTimeout(()=>{var e=document.getElementById('ai_vq');if(e){e.focus();e.setSelectionRange(e.value.length,e.value.length);}},0)"></div>
    <div style="max-height:52vh;overflow:auto">${list.slice(0,160).map(v=>`<div class="it" onclick="aiPickVoice('${esc(v.id)}')" style="cursor:pointer"><span>${v.clone?'<b style="color:#ffb83b">克隆 · </b>':''}${esc(v.name||v.id)}<small>${esc(v.id)}</small></span><span class="v">${v.id===curVoice?'已选':'选'}</span></div>`).join('')||'<div class="empty" style="padding:18px">没有匹配的音色</div>'}${list.length>160?'<div class="hint" style="padding:8px">只显示前160个，用搜索更快</div>':''}</div>
    <button class="btn g" style="margin-top:8px" onclick="closeModal()">关闭</button>`);}
function aiPickVoice(id){S.settings.tts=S.settings.tts||{};S.settings.tts.voice=id;save();closeModal();toast('已设为默认音色');if(cur().p==='aiaccount')render();}
function aiClearVoice(){S.settings.tts=S.settings.tts||{};S.settings.tts.voice='';save();toast('已清空默认音色');render();}
async function aiTestVoice(){const text='我在测试这条语音的花销和声音效果。';
  if(_aiVoiceTestBusy){toast('语音还在生成中，请稍等');return;}
  if(!aiVoiceEnabled()){toast('先打开语音API');return;}
  _aiVoiceTestBusy=true;_aiVoiceTestStatus='语音生成中，请稍等，不要重复点击';if(cur().p==='aiaccount')render();
  try{initAudio();
    if(!aiVoiceRelayOn()&&typeof ttsArr==='function'){
      const ab=await Promise.race([ttsArr(text,{voice:{engine:'api',ttsVoice:((S.settings.tts||{}).voice)||''}}),new Promise(res=>setTimeout(()=>res('__T_O__'),25000))]);
      if(ab==='__T_O__'){_aiVoiceTestStatus='语音测试超时，未完成生成';toast('语音测试超时');return;}
      if(!ab){_aiVoiceTestStatus='没有拿到语音，请检查音色或接口';toast('没有拿到语音');return;}
      const buf=await decodeBuf(ab);if(buf){playBuf(buf);_aiVoiceTestStatus='外置语音测试成功';toast('外置语音测试成功');}else{_aiVoiceTestStatus='拿到语音数据，但播放失败';toast('拿到语音数据，但播放失败');}return;
    }
    const d=await Promise.race([aiRelay('tts',{text,voice_id:((S.settings.tts||{}).voice)||AI_DEFAULT_TTS_VOICE,model:'speech-02-turbo'}),new Promise(res=>setTimeout(()=>res('__T_O__'),25000))]);
    if(d==='__T_O__'){_aiVoiceTestStatus='语音测试超时，未完成生成';toast('语音测试超时');return;}
    const ledger=d&&(d.ledger_id||d.ledgerId||d.request_id),audio=d&&d.data&&d.data.audio;if(!audio){if(typeof ttsRefundLedger==='function')await ttsRefundLedger(ledger,'tts-test-no-audio');_aiVoiceTestStatus='没有拿到语音，请检查音色或后台余额';toast('没有拿到语音');setTimeout(()=>aiAccountRefresh(true,true),600);return;}
    let raw;try{raw=await fetch(audio).then(x=>{if(!x.ok)throw new Error('HTTP '+x.status);return x.arrayBuffer();});}catch(_){if(typeof ttsRefundLedger==='function')await ttsRefundLedger(ledger,'tts-test-fetch-failed');_aiVoiceTestStatus='语音文件下载失败，已退回本次AI点数';toast('下载失败，已退回本次AI点数');setTimeout(()=>aiAccountRefresh(true,true),800);return;}
    const ab=typeof ttsLedgerSet==='function'?ttsLedgerSet(raw,ledger):raw;const buf=await decodeBuf(ab);
    if(buf){playBuf(buf);_aiVoiceTestStatus='语音测试成功';toast('语音测试成功');setTimeout(()=>aiAccountRefresh(true,true),800);}
    else{if(typeof ttsRefundAudio==='function')await ttsRefundAudio(ab,'tts-test-decode-failed');_aiVoiceTestStatus='拿到语音数据，但播放失败，已退回本次AI点数';toast('播放失败，已退回本次AI点数');setTimeout(()=>aiAccountRefresh(true,true),800);}
  }catch(e){let refunded=false;if(typeof ttsRefundError==='function')refunded=await ttsRefundError(e,'tts-test-client-error');_aiVoiceTestStatus='语音测试失败：'+String((e&&e.message)||e).replace(/^内置AI失败：/,'')+(refunded?'，已退回本次AI点数':'');toast(_aiVoiceTestStatus);setTimeout(()=>aiAccountRefresh(true,true),800);}
  finally{_aiVoiceTestBusy=false;if(cur().p==='aiaccount')render();}}

function aiAccountApplyResult(d,action){if(!d)return;if(!_aiAcct)_aiAcct={account:{user_id:aiUserId(),points:0},pricing:null,plans:null,ledger:[]};
  if(d.pricing)_aiAcct.pricing=d.pricing;if(d.plans)_aiAcct.plans=d.plans;if(d.capabilities)_aiAcct.capabilities=d.capabilities;if(d.ledger)_aiAcct.ledger=d.ledger;if(d.purchases)_aiAcct.purchases=d.purchases;if(d.account)_aiAcct.account=d.account;
  if(d.balance!=null){_aiAcct.account=_aiAcct.account||{user_id:aiUserId()};_aiAcct.account.points=d.balance;}
  if(d.charged){const feature=action||'chat';_aiAcct.ledger=_aiAcct.ledger||[];_aiAcct.ledger.unshift({kind:'charge',feature,points:-d.charged,balance_after:d.balance,status:d.ok===false?'failed':'done',billed:!!d.billed,note:d.note||d.error||'',created_at:new Date().toISOString()});_aiAcct.ledger=_aiAcct.ledger.slice(0,80);}
  if(_aiAcct.account&&_aiAcct.account.points!=null)aiCheckLowBalance(Number(_aiAcct.account.points));
  if(cur().p==='aiaccount')setTimeout(()=>{if(cur().p==='aiaccount')render();},30);}
async function aiAccountRefresh(silent,preserveScroll){if(_aiAcctBusy)return;_aiAcctBusy=true;if(silent)_aiAutoTried=true;let ok=false;try{_aiAcct=await aiRelay('account',{});ok=true;if(_aiAcct&&_aiAcct.account)aiCheckLowBalance(Number(_aiAcct.account.points));if(!silent)toast('AI账户已刷新');}catch(e){if(!silent)toast('连接失败：'+e.message);}finally{_aiAcctBusy=false;if(ok&&cur().p==='aiaccount'){const sc=$('.scroll'),top=sc?sc.scrollTop:0;render();if(preserveScroll)setTimeout(()=>{const n=$('.scroll');if(n)n.scrollTop=top;},0);}}}
