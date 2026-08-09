import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');
const preview=fs.readFileSync(new URL('../cohabitation-preview.html',import.meta.url),'utf8');

test('co-living stays separate from one-time dates and is opt-in',()=>{
  assert.match(source,/function cohabRoot\(\)/);
  assert.match(source,/S\.cohabitation/);
  assert.match(source,/function offData\(id\).*S\.offline/s);
  assert.match(source,/共同生活 · 测试版/);
  assert.match(source,/关闭只会暂停/);
  assert.match(source,/function renderOff\(id\).*mode==='cohab'.*renderCohab/s);
  assert.match(source,/function cohabClear\(id\)/);
});

test('co-living state pauses without deleting and advances work to return home',()=>{
  const start=source.indexOf('function cohabRoot()');
  const end=source.indexOf('function offlineFocusStart',start);
  assert.ok(start>=0&&end>start);
  const sandbox={
    S:{contacts:[{id:'c1',name:'角色'}],couple:{cid:'c1'}},
    Date,console,
    getC:id=>id==='c1'?sandbox.S.contacts[0]:null,
    uid:(()=>{let n=0;return()=>`u${++n}`;})(),
    save:()=>{},render:()=>{},toast:()=>{},openOfflineMenu:()=>{},closeModal:()=>{},
    go:()=>{},home:()=>{},openChat:()=>{},cur:()=>({p:'home'}),
    offDateTime:()=> '2026年8月9日 12:00',offElapsed:()=> '1天',esc:String,
    uiConfirm:async()=>true,_off:null,_offSel:null
  };
  vm.runInNewContext(source.slice(start,end)+`
    globalThis.root=cohabRoot();
    cohabToggle();
    globalThis.enabled={enabled:root.enabled,paused:root.paused,msgs:cohabData('c1').msgs.length,startedAt:cohabData('c1').startedAt};
    cohabToggle();
    globalThis.paused={enabled:root.enabled,paused:root.paused,msgs:cohabData('c1').msgs.length,startedAt:cohabData('c1').startedAt};
    root.enabled=true;root.paused=false;
    cohabSetPhase('c1','work',60,{silent:true});
    const d=cohabData('c1');
    globalThis.work={phase:d.phase,nextPhase:d.nextPhase,nextAt:d.nextAt};
    cohabAdvance('c1',d.nextAt);
    globalThis.returning={phase:d.phase,nextPhase:d.nextPhase,nextAt:d.nextAt};
    cohabAdvance('c1',d.nextAt);
    globalThis.homeState={phase:d.phase,unreadReturn:d.unreadReturn};
    cohabSetPhase('c1','away',0,{silent:true,activity:'买晚饭'});
    const applied=cohabApplyStateTags('开门。\\n[共同生活状态|到家|在玄关]','c1',{source:'wechat'});
    globalThis.roleState={phase:d.phase,activity:d.activity,text:applied.text,matched:applied.matched,source:d.stateSource};
    cohabSetPhase('c1','away',0,{silent:true,activity:'买晚饭'});
    const thoughtOnly=cohabInferOnlineState('[内心|她开门了，终于见到我的小狗了。]\\n你先等等。','c1',d);
    globalThis.thoughtState={phase:d.phase,changed:thoughtOnly};
    const atDoor=cohabInferOnlineState('开门。','c1',d);
    globalThis.doorState={phase:d.phase,activity:d.activity,changed:atDoor};
    const entered=cohabInferOnlineState('进来了。\\n过来，让我看看你。','c1',d);
    globalThis.enteredState={phase:d.phase,activity:d.activity,changed:entered,source:d.stateSource,unreadReturn:d.unreadReturn};
  `,sandbox);
  assert.deepEqual({...sandbox.enabled},{enabled:true,paused:false,msgs:1,startedAt:sandbox.enabled.startedAt});
  assert.equal(sandbox.paused.enabled,false);
  assert.equal(sandbox.paused.paused,true);
  assert.equal(sandbox.paused.msgs,1);
  assert.equal(sandbox.paused.startedAt,sandbox.enabled.startedAt);
  assert.equal(sandbox.work.phase,'work');
  assert.equal(sandbox.work.nextPhase,'returning');
  assert.equal(sandbox.returning.phase,'returning');
  assert.equal(sandbox.returning.nextPhase,'home');
  assert.deepEqual({...sandbox.homeState},{phase:'home',unreadReturn:true});
  assert.deepEqual({...sandbox.roleState},{phase:'home',activity:'在玄关',text:'开门。',matched:true,source:'wechat'});
  assert.deepEqual({...sandbox.thoughtState},{phase:'away',changed:false});
  assert.deepEqual({...sandbox.doorState},{phase:'returning',activity:'在门口',changed:true});
  assert.deepEqual({...sandbox.enteredState},{phase:'home',activity:'在家',changed:true,source:'wechat-natural-arrival',unreadReturn:true});
});

test('online and face-to-face activity use a narrow shared status boundary',()=>{
  assert.match(source,/function cohabWechatPrompt\(c,d\)/);
  assert.match(source,/仅在“约会中同步到线上”开关开启时生效/);
  assert.match(source,/共同生活页面里的动作与对白不会复制到微信/);
  assert.match(source,/微信消息也不会冒充面对面台词/);
  assert.match(source,/function offlineFocusActive\(\)\{if\(typeof cohabSceneActive==='function'&&cohabSceneActive\(\)\)return true/);
  assert.match(source,/function incomingCall\(id,kind,opt\)\{if\(offlineFocusActive\(\)\)return false;if\(cohabOnlineQuiet\(id\)\)return false/);
  assert.match(source,/async function maybeProactive\(id\)\{if\(!isMain\(\)\|\|offlineFocusActive\(\)\|\|cohabOnlineQuiet\(id\)/);
  assert.match(source,/去微信联系TA吧/);
  assert.match(source,/function cohabConsumeOnlineState\(text,c,id\)/);
  assert.match(source,/function cohabInferOnlineState\(text,id,d\)/);
  assert.match(source,/content=cohabConsumeOnlineState\(content,c,id\)/);
  assert.match(source,/只有你确实已经抵达、说“我到家了\/进门了”时才能切到到家/);
  assert.match(source,/你可以自己选择挂什么简短状态/);
});

test('co-living UI exposes persistent status, return notice and test controls',()=>{
  assert.match(source,/function renderCohab\(id\)/);
  assert.match(source,/回来了/);
  assert.match(source,/去微信找TA/);
  assert.match(source,/测试控制/);
  assert.match(html,/\.cohab-menu-card/);
  assert.match(html,/\.cohab-status-chip/);
  assert.match(html,/\.cohab-return-banner/);
  assert.match(html,/\.cohab-away-panel/);
  assert.match(html,/\.cohab-wx-state/);
  assert.match(source,/function cohabWechatNavBadge\(c\)/);
  assert.match(source,/page\.p==='off'&&stage\.querySelector\('\.cohab-status-chip'\)/);
  assert.match(preview,/共同生活 · 测试版/);
  assert.match(preview,/data-phase="work"/);
  assert.match(preview,/先生\^\^回来了/);
});

test('co-living condenses the user-selected number of completed rounds into isolated role memories',()=>{
  assert.match(source,/function cohabSummaryCompletedRounds\(rows\)/);
  assert.match(source,/roundLimit=cohabSummaryRoundLimit\(d\)/);
  assert.match(source,/!opt\.force&&\(!roundLimit\|\|Date\.now\(\)<d\.summaryRetryAt\|\|rounds<roundLimit\)/);
  assert.match(source,/function cohabMaybeSummarize\(id,d\)/);
  assert.match(source,/d\.summaries\.push\(\{id:uid\(\),batchId,ts:now,fromSeq:/);
  assert.match(source,/function cohabSummarizeNow\(id\)/);
  assert.match(source,/function cohabMemoryPrompt\(d,query\)/);
  assert.match(source,/共同生活已经自动整理的旧记忆/);
  assert.match(source,/if\(life&&!inspection\)cohabMaybeSummarize\(c\.id,o\)/);
  assert.doesNotMatch(source,/c\.summaries\.push\([^\n]*共同生活/);
});

test('old dates and co-living summaries share the role-perspective memory rule',()=>{
  assert.match(source,/function offSummaryPerspectiveRule\(c\)/);
  assert.match(source,/禁止写成第三人称旁白、剧本梗概、镜头描述/);
  assert.match(source,/普通走路、坐下、起身、拿东西、姿势、衣着和环境描写全部省略/);
  assert.match(source,/function offSummaryFallback\(ended,c,plan\).*m\.who!=='旁白'/);
  assert.match(source,/function offSummarySavePoints\(o,h,c,ended,points,status,error\).*offSummaryMemoryPerspectiveValid/s);
  assert.match(source,/共同生活总结格式不合格/);
});

test('the established offline narration presentation is preserved',()=>{
  const originalRender=source.slice(source.indexOf('function renderOff(id)'),source.indexOf('/* ===== 信箱 ====='));
  assert.match(originalRender,/if\(m\.who==='旁白'\)return `<div class="offnar[^`]+\$\{offRevealText\(m\)\}<\/div>`/);
  assert.doesNotMatch(preview,/<div class="nar">【/);
  assert.doesNotMatch(preview,/】<\/div>/);
  assert.doesNotMatch(html,/\.offnar[^}]*:before[^}]*【/);
  assert.ok(preview.lastIndexOf('.nar{max-width:88%')>preview.lastIndexOf('border-left:1px solid #61584b'));
  assert.doesNotMatch(preview,/class="avatar"/);
});
