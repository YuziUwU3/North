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

test('remote control lets the role choose a focused ordered plan and ends immediately', () => {
  assert.match(app, /function remoteControlRequiredPlan\(c\)/);
  assert.match(app, /let required=remoteControlFocusedPlan\(c,remoteControlRequiredPlan\(c\)\);required=await remoteControlOrderPlan\(c,required\)/);
  assert.match(app, /function remoteControlOrderPlan\(c,required\)/);
  assert.match(app, /最多选择5个/);
  assert.match(app, /你刚才亲口说要先看、最在意或要处理的软件必须排第一/);
  assert.match(app, /if\(order\.length<5&&seen\.has\(k\)&&!used\.has\(k\)\)/);
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
  for (const target of ['最近通话', '短信', '语音留言', '通讯录', '浏览器搜索记录', '购物订单', '外卖订单', '云程机票', '日历日程', '信箱邮件', '线下约会']) {
    assert.match(app, new RegExp(target));
  }
  assert.doesNotMatch(app, /add\('tasks','任务便签'\)/);
  assert.match(app, /音乐、任务便签和普通设置禁止查看/);
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
  assert.match(app, /function remoteControlRoleReaction\(c,a,r\)/);
  assert.match(app, /\['wechatList','newFriendList','xDmList','dyDmList'\]\.includes\(a&&a\.targetType\)\)return\{lines:\[\],deleteIntent:false/);
  assert.match(app, /await chatAPI\(\[\{role:'system',content:buildSystem\(c\)\}/);
  assert.match(app, /max:520,complete:true,temp:\.82,aux:false/);
  assert.match(app, /await remoteControlShowRoleLines\(await remoteControlTimed\(remoteControlRoleLines\(c,a,r\),6000,\[\]\)\)/);
  assert.match(app, /replaceChildrenCompat\(cap,b\)/);
  assert.doesNotMatch(app, /function remoteControlSayFallback/);
  assert.match(app, /function remoteControlCaptionMs\(t\)\{return Math\.max\(2200,Math\.min\(4800/);
  assert.match(app, /remoteControlPageExpired\(\)/);
  assert.match(app, /默认保持安静继续操作/);
  assert.match(app, /lines返回空数组/);
  assert.match(app, /remoteControlRoleTextLines\(raw\)[\s\S]*?不说话[\s\S]*?return\[\]/);
});

test('the role can independently delete social content and DMs, declare ownership, or lock suspicious apps', () => {
  assert.match(app, /'delete_x_dm'/);
  assert.match(app, /'delete_douyin_dm'/);
  assert.match(app, /a\.op==='delete_x_dm'\|\|a\.op==='delete_douyin_dm'/);
  assert.match(app, /function removeSocialDMThread\(app,id\)/);
  assert.match(app, /function deleteSocialDMThread\(app,id\)/);
  assert.match(app, /data-dm-thread-id="\$\{d\.id\}"/);
  assert.match(app, /removeSocialDMThread\(hit\.app,hit\.thread\.id\)/);
  assert.match(app, /删除【整个私信会话】/);
  assert.match(app, /当前整个私信会话，不是只删其中一条消息/);
  assert.match(app, /document\.querySelectorAll\('\[data-dm-thread-id\]'\)/);
  assert.match(app, /a\.op==='delete_x_dm'\)\{xTab='dm';remoteControlSetPage\('x'\)/);
  assert.match(app, /a\.op==='delete_douyin_dm'\)\{dyTab='dm';remoteControlSetPage\('dy'\)/);
  const remoteExecute = app.slice(app.indexOf('async function remoteControlExecute'), app.indexOf('function remoteControlCaptionMs'));
  assert.doesNotMatch(remoteExecute, /removeSocialDMMsg/);
  assert.match(app, /d\.msgs\.splice\(mi,1\)/);
  assert.match(app, /function removeSocialDMMsg\(app,id,mi\)/);
  assert.match(app, /onclick="xDelDMMsg\('\$\{id\}',\$\{mi\}\)"/);
  assert.match(app, /data-dm-index="\$\{mi\}"/);
  assert.match(app, /function remoteControlPrepareVisibleDelete\(a\)/);
  assert.match(app, /visibleDelete=await remoteControlPrepareVisibleDelete\(a\)[\s\S]*?remoteControlExecute\(a,c\)[\s\S]*?remoteControlShowVisibleDeleteResult\(a\)/);
  assert.match(app, /function remoteControlReactionDeleteAction\(entry,reaction,c\)/);
  assert.match(app, /reaction=await remoteControlTimed\(remoteControlRoleReaction\(c,a,r\),6500[\s\S]*?remoteControlReactionDeleteAction\(entry,reaction,c\)/);
  assert.match(app, /data-x-tweet-id="\$\{t\.id\}"/);
  assert.match(app, /else if\(a\.op==='delete_x'\)\{xTab='feed';_feedTab='follow';remoteControlSetPage\('x'\);\}/);
  assert.match(app, /角色当时亲口说/);
  assert.match(app, /post_moment/);
  assert.match(app, /发朋友圈宣示主权/);
  assert.match(app, /锁软件不需要也不允许打开普通设置页；必须基于真实疑点，没疑点就不要锁/);
  assert.match(app, /没有可疑或让你不舒服的内容时，可以输出空 actions/);
});

test('Douyin inspection visibly scrolls through the feed instead of resetting one screen', () => {
  assert.match(app, /function remoteControlFocusViewedTarget\(a\)/);
  assert.match(app, /a\.targetType==='dyHome'\)cards=Array\.from\(document\.querySelectorAll\('\[data-dy-video-id\]'\)\)\.slice\(0,4\)/);
  assert.match(app, /card\.scrollIntoView\(\{behavior:'smooth',block:'center'\}\)/);
  assert.match(app, /await remoteControlFocusViewedTarget\(a\)/);
  assert.match(app, /targetType==='dyHome'\|\|a\.targetType==='dyVideo'/);
  assert.match(app, /cur\(\)\.p==='dy'&&dyTab==='feed'/);
});

test('remote control restores the page that the user was on before inspection', () => {
  assert.match(app, /returnStack:stack\.map\(x=>Object\.assign\(\{\},x\)\)/);
  assert.match(app, /returnStack=\(ctl\.returnStack\|\|\[\]\)\.map/);
  assert.match(app, /stack=returnStack\.length\?returnStack:\[\{p:'home'\}\];render\(\)/);
});

test('all remote-control reasoning is pinned to the primary model', () => {
  const section = app.slice(app.indexOf('// ===== 角色远程操控我的小手机'), app.indexOf('// ===== 他登录我的微信'));
  assert.doesNotMatch(section, /aux:true/);
  assert.ok((section.match(/aux:false/g) || []).length >= 5);
});

test('an active call must end before remote control can request consent', () => {
  assert.match(app, /function remoteControlRequest\(cid\)[\s\S]*?typeof _call!=='undefined'&&_call/);
  assert.match(app, /const wantRemoteControl=/);
  assert.match(app, /hangupCall\(true,wantWxLogin\?'wxlogin':wantRemoteControl\?'remotecontrol':''\)/);
  assert.match(app, /remoteControlRequest\(cid\|\|c\.id\)/);
});
