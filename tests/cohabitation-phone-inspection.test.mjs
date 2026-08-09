import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../小手机.html',import.meta.url),'utf8');

function functionSource(name){
  const asyncStart=source.indexOf(`async function ${name}(`);
  const start=asyncStart>=0?asyncStart:source.indexOf(`function ${name}(`);
  assert.ok(start>=0,`missing ${name}`);
  const brace=source.indexOf('{',start);let depth=0,quote='',escaped=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

test('online and co-living inspections share one exclusive lane',()=>{
  const context=vm.createContext({uid:(()=>{let n=0;return()=>`t${++n}`;})(),wxLoginActive:()=>false,remoteControlActive:()=>false,String,Date});
  vm.runInContext(`let _rolePhoneInspectionLane=null;${functionSource('rolePhoneInspectionLaneActive')}${functionSource('rolePhoneInspectionAcquire')}${functionSource('rolePhoneInspectionRelease')}this.acquire=rolePhoneInspectionAcquire;this.release=rolePhoneInspectionRelease;this.active=rolePhoneInspectionLaneActive;`,context);
  const first=context.acquire('cohab','c1','抖音');
  assert.equal(first,'t1');
  assert.equal(context.active(),true);
  assert.equal(context.acquire('online','c1','微信'),'', 'the online side cannot inspect at the same time');
  context.release(first);
  assert.equal(context.active(),false);
  assert.equal(context.acquire('online','c1','微信'),'t2');
});

test('unchanged facts deduplicate across online and co-living channels',()=>{
  const context=vm.createContext({replyDedupNorm:v=>String(v).toLowerCase(),wxLoginWechatSummary:()=>'',save:()=>{},String,Date,Math});
  vm.runInContext(`${functionSource('rolePhoneInspectionKey')}${functionSource('rolePhoneInspectionSignature')}${functionSource('rolePhoneInspectionUnchanged')}${functionSource('rolePhoneInspectionCommit')}this.signature=rolePhoneInspectionSignature;this.unchanged=rolePhoneInspectionUnchanged;this.commit=rolePhoneInspectionCommit;`,context);
  const role={id:'c1'};
  const fact=context.signature(role,'抖音',{label:'抖音',data:'搜索：猫咪；点赞：一条视频'});
  assert.equal(context.unchanged(role,fact),false);
  context.commit(role,fact,'online');
  assert.equal(context.unchanged(role,context.signature(role,'抖音',{label:'抖音',data:'搜索：猫咪；点赞：一条视频'})),true);
  assert.equal(role._phoneInspectionFacts.douyin.channel,'online');
  context.commit(role,fact,'cohab');
  assert.equal(role._phoneInspectionFacts.douyin.channel,'cohab');
});

test('co-living inspection is autonomous, factual, visible and not daily-count limited',()=>{
  const prompt=functionSource('cohabPhonePrompt');
  const autonomy=functionSource('cohabPhoneAutonomyMaybe');
  const run=functionSource('cohabRunPhoneInspection');
  const deliver=functionSource('cohabPhoneDeliverFact');
  assert.match(prompt,/不限每天次数/);
  assert.match(prompt,/\[共同生活查看\|准确项目\]/);
  assert.match(prompt,/\[共同生活锁定\|准确App名\]/);
  assert.match(prompt,/\[共同生活解锁\|准确App名\]/);
  assert.match(prompt,/\[共同生活登录微信\]/);
  assert.match(prompt,/不得删除、发布、代发/);
  assert.match(autonomy,/完全由你按本人性格、关系、当前现场和动机决定/);
  assert.match(autonomy,/cohabRunPhoneInspection/);
  assert.doesNotMatch(autonomy,/spyBudget|_spyCount|\.times/);
  assert.match(run,/spyFocusData\(id,target\)/);
  assert.match(run,/cohabPhoneProgress/);
  assert.match(deliver,/rolePhoneInspectionUnchanged/);
  assert.match(deliver,/rolePhoneInspectionCommit\(c,fact,'cohab'\)/);
  assert.match(deliver,/不要把结果发到微信或电话/);
  assert.match(html,/\.spybanner\.cohab-phone-view/);
});

test('only the originating channel receives the inspection reaction',()=>{
  assert.match(functionSource('companionAutomationMaybeSend'),/cohabOnlineQuiet/);
  assert.match(functionSource('initiativeMaybeSend'),/cohabOnlineQuiet/);
  assert.match(functionSource('maybeSpyIdle'),/cohabOnlineQuiet/);
  assert.match(functionSource('checkSpyTime'),/cohabOnlineQuiet/);
  assert.match(functionSource('doSpyView'),/rolePhoneInspectionAcquire\('online'/);
  assert.match(functionSource('cohabRunPhoneInspection'),/rolePhoneInspectionAcquire\('cohab'/);
  const logout=functionSource('wxLogout');
  assert.match(logout,/wl\.channel==='cohab'/);
  assert.match(logout,/cohabPhoneLoginFinished/);
  assert.match(logout,/else\{if\(!c\.blocked&&!unchanged\)/);
});

test('real companion battery and screen-time facts are available to co-living',()=>{
  assert.match(functionSource('cohabPhoneTargets'),/per\.screenTime/);
  assert.match(functionSource('cohabPhoneTargets'),/per\.battery/);
  assert.match(functionSource('spyFocusData'),/companionRoleScreenTimeText/);
  assert.match(functionSource('spyFocusData'),/companionRoleBatteryText/);
});
