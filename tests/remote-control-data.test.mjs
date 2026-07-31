import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../小手机.html',import.meta.url),'utf8');

test('remote viewing reuses real stored records',()=>{
  assert.match(app,/function remoteControlPhoneSnapshot\(\)/);
  assert.match(app,/p\.recents\|\|\[\]/);
  assert.match(app,/Object\.keys\(p\.sms\|\|\{\}\)/);
  assert.match(app,/p\.voicemail\|\|\[\]/);
  assert.match(app,/function foodOrderRows\(\)/);
  assert.match(app,/S\.shop&&S\.shop\.orders/);
  assert.match(app,/S\.travel&&S\.travel\.trips/);
});

test('remote viewing opens real apps and stores only viewed facts',()=>{
  assert.match(app,/function remoteControlViewFact\(a,c\)/);
  assert.match(app,/function remoteControlPlanningSnapshot\(c\)/);
  assert.match(app,/if\(app==='travel'\)\{tvInit\(\);_tvTab='trips'/);
  assert.match(app,/if\(app==='shop'\)\{remoteControlSetPage\('shop'\)/);
  assert.match(app,/openOrders\(\)/);
  assert.match(app,/if\(app==='food'\)\{remoteControlSetPage\('food'\)/);
  assert.match(app,/openFoodOrders\(\)/);
  assert.match(app,/targetType==='browserHistory'[\s\S]*?brHistory\(\)/);
  assert.match(app,/targetType==='dySearchHistory'[\s\S]*?dyTab='search'/);
});

test('the role chooses a scoped app plan instead of an exhaustive pass',()=>{
  assert.match(app,/function remoteControlRequiredPlan\(c\)/);
  assert.match(app,/let required=remoteControlRequiredPlan\(c\);required=await remoteControlOrderPlan\(c,required\)/);
  assert.match(app,/async function remoteControlOrderPlan\(c,required\)/);
  assert.match(app,/picked\.forEach\(k=>\{if\(seen\.has\(k\)&&!used\.has\(k\)\)/);
  assert.match(app,/hintApps\.length\?hintApps:apps\.slice\(0,2\)/);
  assert.match(app,/remoteControlContextWantsBroad\(ctx\)/);
  assert.doesNotMatch(app,/picked\.concat\(apps\)/);
  assert.match(app,/\.filter\(x=>x\.op&&x\.op!=='view'\)/);
  assert.doesNotMatch(app,/remoteProgressFill/);
  assert.equal((html.match(/class="remote-live-dot"/g)||[]).length,1);
});

test('chat and DM detail choices remain role-driven',()=>{
  assert.match(app,/function remoteControlWechatCandidates\(c\)/);
  assert.match(app,/function remoteControlWechatChoicePlan\(c\)/);
  assert.match(app,/targetType:'wechatList'/);
  assert.match(app,/required\.splice\(i\+1,0,\.\.\.choices\)/);
  assert.match(app,/function remoteControlWechatEnterFromList\(a\)/);
  assert.match(app,/function remoteControlWechatExitToList\(\)/);
  assert.match(app,/function remoteControlDmChoicePlan\(c,app\)/);
  assert.match(app,/function remoteControlDmEnterFromList\(a\)/);
  assert.match(app,/function remoteControlDmExitToList\(app\)/);
  assert.match(app,/targetType:'xDmList'/);
  assert.match(app,/targetType:'dyDmList'/);
  assert.match(app,/else if\(a\.fromDmList\)await remoteControlDmExitToList\(a\.app\)/);
});

test('remote subtitles are role-generated, quiet on list pages, and time-bounded',()=>{
  assert.match(app,/function remoteControlRoleLines\(c,a,r\)/);
  assert.match(app,/function remoteControlRoleReaction\(c,a,r\)/);
  assert.match(app,/\['wechatList','xDmList','dyDmList'\]\.includes\(a&&a\.targetType\)\)return\{lines:\[\],deleteIntent:false/);
  assert.match(app,/max:520,complete:true,temp:\.82,aux:false/);
  assert.match(app,/remoteControlTimed\(remoteControlRoleReaction\(c,a,r\),6500/);
  assert.match(app,/remoteControlTimed\(remoteControlRoleLines\(c,a,r\),5000/);
  assert.doesNotMatch(app,/function remoteControlSayFallback/);
});

test('the role can independently act only on allowlisted visible data',()=>{
  assert.match(app,/'delete_x_dm'/);
  assert.match(app,/'delete_douyin_dm'/);
  assert.match(app,/function removeSocialDMThread\(app,id\)/);
  assert.match(app,/function deleteSocialDMThread\(app,id\)/);
  assert.match(app,/function remoteControlPrepareVisibleDelete\(a\)/);
  assert.match(app,/visibleDelete=await remoteControlPrepareVisibleDelete\(a\)[\s\S]*?remoteControlExecute\(a,c\)/);
  assert.match(app,/reaction=await remoteControlTimed\(remoteControlRoleReaction\(c,a,r\),6500[\s\S]*?remoteControlReactionDeleteAction\(entry,reaction,c\)/);
  assert.match(app,/a\.op==='delete_phone_contact'/);
  assert.match(app,/a\.op==='delete_sms_thread'/);
});

test('Douyin inspection visibly scrolls rather than resetting one screen',()=>{
  assert.match(app,/function remoteControlFocusViewedTarget\(a\)/);
  assert.match(app,/card\.scrollIntoView\(\{behavior:'smooth',block:'center'\}\)/);
  assert.match(app,/await remoteControlFocusViewedTarget\(a\)/);
});

test('remote control restores the page the user was on',()=>{
  assert.match(app,/returnStack:stack\.map\(x=>Object\.assign\(\{\},x\)\)/);
  assert.match(app,/stack=returnStack\.length\?returnStack:\[\{p:'home'\}\];render\(\)/);
});

test('all remote reasoning stays on the primary model',()=>{
  const start=app.indexOf('let _remoteCtl=');
  const end=app.indexOf('let _wxLoginTimer=',start);
  const remote=app.slice(start,end);
  assert.ok(start>=0&&end>start);
  assert.doesNotMatch(remote,/aux:true/);
  assert.ok((remote.match(/aux:false/g)||[]).length>=5);
});

test('an active call ends before remote control requests consent',()=>{
  assert.match(app,/function remoteControlRequest\(cid\)[\s\S]*?typeof _call!=='undefined'&&_call/);
  assert.match(app,/hangupCall\(true,wantWxLogin\?'wxlogin':wantRemoteControl\?'remotecontrol':''\)/);
});
