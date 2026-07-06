/* ---------- AI账户 / 内置AI ---------- */
let _aiAcct=null,_aiAcctBusy=false,_aiUnlocked=false,_aiAutoTried=false,_aiVoiceList=[],_aiVoiceQ='';

function openAIAccount(){if(_aiUnlocked){go('aiaccount');return;}
  openModal(`<h3>AI账户密码</h3><div class="hint">这里是后台测试入口，输入密码后进入。</div>
    <div class="field"><input id="ai_pin" type="password" inputmode="numeric" maxlength="8" placeholder="输入密码"></div>
    <div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="aiUnlock()">进入</button></div>`);
  setTimeout(()=>{const el=$('#ai_pin');if(el){el.focus();el.onkeydown=e=>{if(e.key==='Enter')aiUnlock();};}},60);}
function aiUnlock(){const v=(($('#ai_pin')||{}).value||'').trim();if(v!=='0414'){toast('密码不对');return;}_aiUnlocked=true;closeModal();go('aiaccount');}
function aiCoreInit(){S.settings.aiCore=S.settings.aiCore||{enabled:false,url:GATE_URL+'/functions/v1/phone-ai'};if(!S.settings.aiCore.url)S.settings.aiCore.url=GATE_URL+'/functions/v1/phone-ai';return S.settings.aiCore;}
function aiVoiceEnabled(){return typeof ttsEnabled==='function'?ttsEnabled(S.settings.tts||{}):!!((S.settings.tts||{}).enabled);}
function aiVoiceRelayOn(){return !!((S.settings.tts||{}).relay&&aiCoreUrl());}
function aiExternalTts(){const t=(typeof ttsCfg==='function'?ttsCfg():(S.settings.tts||{}));return t&&t.base&&t.key?t:null;}
function aiPrice(k){const p=(_aiAcct&&_aiAcct.pricing)||{chat:10,vision:25,image:120,tts:10,summary:2};return p[k]||0;}
function aiLedgerTime(v){if(!v)return '';const d=new Date(v);if(isNaN(d))return String(v).replace('T',' ').slice(0,16);return d.toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});}
function aiLedgerRows(){const rows=((_aiAcct&&_aiAcct.ledger)||[]).slice().sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)),names={chat:'聊天',vision:'识图',image:'生图',tts:'语音',summary:'总结',manual:'手动加点',free:'赠送'};return rows.length?rows.map(x=>{const meta=x.meta||{},failed=x.status==='failed',billed=failed&&(meta.charged||x.billed),title=(names[x.feature]||x.feature)+(failed?(billed?' · 失败已计费':' · 失败已退点'):'');const note=meta.note||x.note||(failed?(meta.reason||'模型返回失败'):'');return `<div class="bill"><div><b>${esc(title)}</b><small>${esc(aiLedgerTime(x.created_at))}${note?' · '+esc(String(note).slice(0,80)):''}</small></div><div class="${x.points>=0?'pos':'neg'}">${x.points>0?'+':''}${x.points}</div></div>`;}).join(''):'<div class="empty">还没有流水</div>';}

function renderAIAccount(){const ac=aiCoreInit();const id=aiUserId();S.settings.tts=S.settings.tts||{};const tts=S.settings.tts;setTimeout(()=>{if(cur().p==='aiaccount'&&!_aiAcct&&!_aiAcctBusy&&!_aiAutoTried)aiAccountRefresh(true,true);},80);
  const bal=_aiAcct&&_aiAcct.account?(_aiAcct.account.points||0):'--';
  const voice=(tts.voice)||'未选择';
  return `<div class="nav"><span class="l" onclick="back()">‹</span><span class="t">AI账户</span><span class="r" onclick="aiAccountRefresh()">刷新</span></div>
  <div class="scroll" style="background:#0f1117;color:#e8eaf0;padding:12px">
    <div style="background:linear-gradient(135deg,#1f2937,#4f46e5);border-radius:16px;padding:18px 16px;margin-bottom:12px;border:1px solid rgba(255,255,255,.12)">
      <div style="font-size:12px;color:#c7d2fe">小手机内置AI点数</div>
      <div style="font-size:38px;font-weight:700;margin:6px 0">${bal}</div>
      <div style="font-size:12px;color:#cbd5e1;word-break:break-all">用户ID：${esc(id)} <button class="minibtn" onclick="aiCopyId()" style="margin-left:6px">复制</button></div>
    </div>
    <div class="section">
      <div class="it"><span>使用内置AI<br><small style="color:#888">聊天/识图/生图主通道暂不开放；开启需要管理密码。语音API有单独开关。</small></span><span class="sw ${ac.enabled?'on':''}" onclick="aiToggleCore()"></span></div>
      <div class="it"><span>内置语音<br><small style="color:#888">开：角色语音条和语音电话走部署后台；关：若设置里填了外置海螺，则走外置海螺。</small></span><span class="sw ${aiVoiceRelayOn()?'on':''}" onclick="aiToggleVoiceApi()"></span></div>
    </div>
    <div class="section">
      <div style="padding:12px 14px;font-weight:600;color:#a5b4fc">语音计费表</div>
      <div class="it"><span>小手机扣点</span><span class="v">${aiPrice('tts')} 点 / 次</span></div>
      <div class="it"><span>官方成本估算<small>speech-02-turbo 约按字符扣费</small></span><span class="v">约 ¥0.0002 / 字</span></div>
      <div class="it"><span>参考花费<small>100字约¥0.02，500字约¥0.10</small></span><span class="v">成功才扣点</span></div>
      <div class="it"><span>失败规则<small>没拿到可播放语音，小手机点数退回</small></span><span class="v">失败退点</span></div>
    </div>
    <div class="section">
      <div style="padding:12px 14px;font-weight:600;color:#a5b4fc">语音音色</div>
      <div class="hint" style="padding:0 14px 8px">选中的音色会作为小手机默认语音音色。</div>
      <div class="it"><span>默认音色<small>${esc(voice)}</small></span><span class="v"><button class="minibtn" onclick="aiPullVoices()">拉取音色</button></span></div>
      <div class="btns" style="padding:0 14px 10px"><button class="btn g" onclick="aiClearVoice()">清空音色</button><button class="btn p" onclick="aiTestVoice()">测试语音</button></div>
    </div>
    <div class="section">
      <div style="padding:12px 14px;font-weight:600;color:#a5b4fc">最近流水<small style="display:block;color:#777;font-weight:400;margin-top:3px">按本地时间显示，最多保留80条</small></div>
      <div id="ai_ledger">${aiLedgerRows()}</div>
    </div>
    <div class="hint">充值套餐已暂时隐藏。测试阶段由你在 Supabase 手动给用户ID加点。</div>
  </div>`;}

function aiToggleCore(){const ac=aiCoreInit();if(ac.enabled){ac.enabled=false;save();render();toast('已关闭内置AI');return;}
  openModal(`<h3>开启内置AI</h3><div class="hint">聊天/识图/生图主通道暂不开放。确认要开启请输入管理密码。</div>
    <div class="field"><input id="ai_core_pin" type="password" inputmode="numeric" maxlength="8" placeholder="输入管理密码"></div>
    <div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="aiCoreUnlock()">开启</button></div>`);
  setTimeout(()=>{const el=$('#ai_core_pin');if(el){el.focus();el.onkeydown=e=>{if(e.key==='Enter')aiCoreUnlock();};}},60);}
function aiCoreUnlock(){const v=(($('#ai_core_pin')||{}).value||'').trim();if(v!=='206414'){toast('管理密码不对');return;}const ac=aiCoreInit();ac.enabled=true;save();closeModal();render();toast('已开启内置AI');}
function aiToggleVoiceApi(){S.settings.tts=S.settings.tts||{};S.settings.tts.relay=!aiVoiceRelayOn();if(S.settings.tts.relay)S.settings.tts.enabled=true;save();render();toast(S.settings.tts.relay?'内置语音已开启':'内置语音已关闭');}
function aiCopyId(){try{navigator.clipboard&&navigator.clipboard.writeText(aiUserId());}catch(_){}toast('已复制用户ID');}

async function aiPullVoices(){toast('正在拉取音色…');
  try{const ext=aiExternalTts();
    if(!aiVoiceRelayOn()&&ext&&/minimax/i.test(ext.base||'')){
      const base=(ext.base||'').replace(/\/+$/,'');
      const r=await fetch(base+'/v1/get_voice',{method:'POST',headers:{'Authorization':'Bearer '+ext.key,'Content-Type':'application/json'},body:JSON.stringify({voice_type:'all'})});
      const d=await r.json().catch(()=>null);
      if(!d||(d.base_resp&&d.base_resp.status_code!==0)){toast('拉取失败：'+((d&&d.base_resp&&d.base_resp.status_msg)||r.status));return;}
      const clones=(d.voice_cloning||[]).map(v=>({id:v.voice_id,name:v.voice_name||'我的克隆',clone:true}));
      const sys=(d.system_voice||[]).map(v=>({id:v.voice_id,name:v.voice_name||v.voice_id}));
      _aiVoiceList=clones.concat(sys);_aiVoiceQ='';
      if(!_aiVoiceList.length){toast('没有拉到音色，检查 MiniMax Key / GroupId');return;}
      aiShowVoicePicker();return;
    }
    const d=await aiRelay('tts_voices',{});_aiVoiceList=(d&&d.voices)||[];_aiVoiceQ='';
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
  if(!aiVoiceEnabled()){toast('先打开语音API');return;}
  toast('正在生成语音…');
  try{initAudio();
    if(!aiVoiceRelayOn()&&typeof ttsArr==='function'){
      const ab=await Promise.race([ttsArr(text,{voice:{engine:'api',ttsVoice:((S.settings.tts||{}).voice)||''}}),new Promise(res=>setTimeout(()=>res('__T_O__'),25000))]);
      if(ab==='__T_O__'){toast('语音测试超时');return;}
      if(!ab){toast('没有拿到语音');return;}
      const buf=await decodeBuf(ab);if(buf){playBuf(buf);toast('外置语音测试成功');}else toast('拿到语音数据，但播放失败');return;
    }
    const d=await Promise.race([aiRelay('tts',{text,voice_id:((S.settings.tts||{}).voice)||'',model:((S.settings.tts||{}).model)||''}),new Promise(res=>setTimeout(()=>res('__T_O__'),25000))]);
    if(d==='__T_O__'){toast('语音测试超时');return;}
    const audio=d&&d.data&&d.data.audio;if(!audio){toast('没有拿到语音');setTimeout(()=>aiAccountRefresh(true,true),600);return;}
    const ab=await fetch(audio).then(x=>x.arrayBuffer());const buf=await decodeBuf(ab);
    if(buf){playBuf(buf);toast('语音测试成功，流水里会显示语音扣点');setTimeout(()=>aiAccountRefresh(true,true),800);}
    else toast('拿到语音数据，但播放失败');
  }catch(e){toast('语音测试失败：'+String((e&&e.message)||e).replace(/^内置AI失败：/,''));setTimeout(()=>aiAccountRefresh(true,true),800);}}

function aiAccountApplyResult(d,action){if(!d)return;if(!_aiAcct)_aiAcct={account:{user_id:aiUserId(),points:0},pricing:null,plans:null,ledger:[]};
  if(d.pricing)_aiAcct.pricing=d.pricing;if(d.plans)_aiAcct.plans=d.plans;if(d.ledger)_aiAcct.ledger=d.ledger;if(d.account)_aiAcct.account=d.account;
  if(d.balance!=null){_aiAcct.account=_aiAcct.account||{user_id:aiUserId()};_aiAcct.account.points=d.balance;}
  if(d.charged){const feature=action||'chat';_aiAcct.ledger=_aiAcct.ledger||[];_aiAcct.ledger.unshift({kind:'charge',feature,points:-d.charged,balance_after:d.balance,status:d.ok===false?'failed':'done',billed:!!d.billed,note:d.note||d.error||'',created_at:new Date().toISOString()});_aiAcct.ledger=_aiAcct.ledger.slice(0,80);}
  if(cur().p==='aiaccount')setTimeout(()=>{if(cur().p==='aiaccount')render();},30);}
async function aiAccountRefresh(silent,preserveScroll){if(_aiAcctBusy)return;_aiAcctBusy=true;if(silent)_aiAutoTried=true;let ok=false;try{_aiAcct=await aiRelay('account',{});ok=true;if(!silent)toast('AI账户已刷新');}catch(e){if(!silent)toast('连接失败：'+e.message);}finally{_aiAcctBusy=false;if(ok&&cur().p==='aiaccount'){const sc=$('.scroll'),top=sc?sc.scrollTop:0;render();if(preserveScroll)setTimeout(()=>{const n=$('.scroll');if(n)n.scrollTop=top;},0);}}}
