import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const app = readFileSync(join(root, 'app.js'), 'utf8');
const html = readFileSync(join(root, '小手机.html'), 'utf8');

test('remote viewing reuses real order, travel, and phone records', () => {
  assert.match(app, /function remoteControlPhoneSnapshot\(\)/);
  assert.match(app, /p\.recents\|\|\[\]/);
  assert.match(app, /Object\.keys\(p\.sms\|\|\{\}\)/);
  assert.match(app, /p\.voicemail\|\|\[\]/);
  assert.match(app, /function foodOrderRows\(\)/);
  assert.match(app, /S\.shop&&S\.shop\.orders/);
  assert.match(app, /S\.travel&&S\.travel\.trips/);
  assert.match(app, /phoneCalls:pc\.calls,phoneSms:pc\.sms,phoneVoicemail:pc\.voicemail/);
});

test('remote viewing opens the matching real app and remembers only viewed facts', () => {
  assert.match(app, /function remoteControlViewFact\(a,c\)/);
  assert.match(app, /实际看到/);
  assert.match(app, /function remoteControlPlanningSnapshot\(c\)/);
  assert.match(app, /inv\[k\]=Array\.isArray\(x\)\?\{count:x\.length\}/);
  assert.match(app, /你刚刚亲手打开并仔细看完/);
  assert.match(app, /不能编造屏幕上没有的内容/);
  assert.match(app, /if\(app==='travel'\)\{tvInit\(\);_tvTab='trips'/);
  assert.match(app, /if\(app==='shop'\)\{remoteControlSetPage\('shop'\)/);
  assert.match(app, /openOrders\(\)/);
  assert.match(app, /if\(app==='food'\)\{remoteControlSetPage\('food'\)/);
  assert.match(app, /openFoodOrders\(\)/);
  assert.match(app, /if\(app==='phoneapp'\)\{const p=phState\(\);p\.tab=/);
  assert.match(app, /travel:'travel'/);
  assert.match(app, /targetType==='browserHistory'[\s\S]*?brHistory\(\)/);
  assert.match(app, /targetType==='dySearchHistory'[\s\S]*?dyTab='search'/);
});

test('remote control lets the role order an exhaustive plan and ends immediately', () => {
  assert.match(app, /function remoteControlRequiredPlan\(c\)/);
  assert.match(app, /let required=remoteControlRequiredPlan\(c\);required=await remoteControlOrderPlan\(c,required\)/);
  assert.match(app, /function remoteControlOrderPlan\(c,required\)/);
  assert.match(app, /不能漏掉、增加或重复任何app/);
  assert.match(app, /if\(seen\.has\(k\)&&!used\.has\(k\)\)/);
  assert.match(app, /离开后不能再返回查看，也不能开始第二轮巡查/);
  assert.match(app, /\.filter\(x=>x\.op&&x\.op!=='view'\)/);
  assert.match(app, /S\.me\.appLayout\.flat\(\)\.forEach/);
  assert.match(app, /S\.me\.appLayout\[i\]\.indexOf\(key\)/);
  assert.doesNotMatch(app, /'好了，这次我看完了。'/);
  assert.doesNotMatch(app, /remoteProgressFill/);
  assert.doesNotMatch(html, /remote-caption-bubble:before/);
  assert.equal((html.match(/class="remote-live-dot"/g) || []).length, 1);
});

test('required apps are inspected while chats and DMs are chosen from their visible lists', () => {
  assert.match(app, /function remoteControlWechatCandidates\(c\)/);
  assert.match(app, /function remoteControlWechatChoicePlan\(c\)/);
  assert.match(app, /targetType:'wechatList'/);
  assert.match(app, /required\.splice\(i\+1,0,\.\.\.choices\)/);
  assert.match(app, /function remoteControlWechatEnterFromList\(a\)/);
  assert.match(app, /function remoteControlWechatExitToList\(\)/);
  assert.match(app, /else if\(a\.fromWechatList\)await remoteControlWechatExitToList\(\)/);
  assert.match(app, /function remoteControlDmChoicePlan\(c,app\)/);
  assert.match(app, /function remoteControlDmEnterFromList\(a\)/);
  assert.match(app, /function remoteControlDmExitToList\(app\)/);
  assert.match(app, /targetType:'xDmList'/);
  assert.match(app, /targetType:'dyDmList'/);
  const dyHome = app.indexOf("add('douyin','抖音首页',{targetType:'dyHome'})");
  const dySearch = app.indexOf("add('douyin','抖音搜索记录',{targetType:'dySearchHistory'})");
  const dyVideos = app.indexOf("snap.douyin.forEach(x=>add('douyin','抖音「");
  const dyDms = app.indexOf("add('douyin','抖音私信会话列表',{targetType:'dyDmList'})");
  assert.ok(dyHome >= 0 && dyHome < dySearch && dySearch < dyVideos && dyVideos < dyDms);
  assert.match(app, /else if\(a\.fromDmList\)await remoteControlDmExitToList\(a\.app\)/);
  assert.match(app, /snap\.moments\.forEach\(x=>add\('moments'/);
  for (const target of ['最近通话', '短信', '语音留言', '通讯录', '浏览器搜索记录', '购物订单', '外卖订单', '云程机票', '日历日程', '信箱邮件', '任务便签', '线下约会']) {
    assert.match(app, new RegExp(target));
  }
  assert.match(app, /a\.targetType==='role'/);
  assert.match(app, /a\.targetType==='internalGroup'/);
  assert.match(app, /a\.targetType==='xDm'/);
  assert.match(app, /a\.targetType==='dyDm'/);
  assert.match(app, /viewedWechat=new Set/);
  assert.match(app, /roles:\(snap\.wechat\.roles\|\|\[\]\)\.filter/);
  assert.match(app, /data-couple-permission="grant:\$\{k\}"/);
  assert.match(app, /function remoteControlCouplePermissionElement\(key,section\)/);
  assert.match(app, /x\.dataset\.couplePermission===String\(key\|\|''\)/);
});

test('remote subtitles are one at a time and every visible line comes from the role API', () => {
  assert.match(app, /function remoteControlRoleLines\(c,a,r\)/);
  assert.match(app, /await chatAPI\(\[\{role:'system',content:buildSystem\(c\)\}/);
  assert.match(app, /await remoteControlShowRoleLines\(await remoteControlRoleLines\(c,a,r\)\)/);
  assert.match(app, /cap\.replaceChildren\(b\)/);
  assert.doesNotMatch(app, /function remoteControlSayFallback/);
  assert.match(app, /function remoteControlCaptionMs\(t\)\{return Math\.max\(4600/);
  assert.match(app, /默认保持安静继续操作/);
  assert.match(app, /只输出 \[不说话\]/);
  assert.match(app, /remoteControlRoleTextLines\(raw\)[\s\S]*?不说话[\s\S]*?return\[\]/);
});

test('the role can independently delete social content and DMs, declare ownership, or lock suspicious apps', () => {
  assert.match(app, /'delete_x_dm'/);
  assert.match(app, /'delete_douyin_dm'/);
  assert.match(app, /a\.op==='delete_x_dm'\|\|a\.op==='delete_douyin_dm'/);
  assert.match(app, /t\.msgs\.splice\(idx,1\)/);
  assert.match(app, /post_moment/);
  assert.match(app, /发朋友圈宣示主权/);
  assert.match(app, /锁软件必须基于真实疑点；没疑点就不要锁/);
  assert.match(app, /没有可疑或让你不舒服的内容时，可以输出空 actions/);
});

test('an active call must end before remote control can request consent', () => {
  assert.match(app, /function remoteControlRequest\(cid\)[\s\S]*?typeof _call!=='undefined'&&_call/);
  assert.match(app, /const wantRemoteControl=/);
  assert.match(app, /hangupCall\(true,wantWxLogin\?'wxlogin':wantRemoteControl\?'remotecontrol':''\)/);
  assert.match(app, /remoteControlRequest\(cid\|\|c\.id\)/);
});
