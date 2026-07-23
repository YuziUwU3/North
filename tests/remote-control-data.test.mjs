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
});

test('remote control starts with a deterministic exhaustive plan, follows layout, and ends immediately', () => {
  assert.match(app, /function remoteControlRequiredPlan\(c\)/);
  assert.match(app, /const required=remoteControlRequiredPlan\(c\)/);
  assert.match(app, /S\.me\.appLayout\.flat\(\)\.forEach/);
  assert.match(app, /S\.me\.appLayout\[i\]\.indexOf\(key\)/);
  assert.doesNotMatch(app, /'好了，这次我看完了。'/);
  assert.doesNotMatch(app, /remoteProgressFill/);
  assert.doesNotMatch(html, /remote-caption-bubble:before/);
  assert.equal((html.match(/class="remote-live-dot"/g) || []).length, 1);
});

test('every supported app and every openable social conversation is inspected', () => {
  assert.match(app, /snap\.wechat\.roles\|\|\[\]\)\.map\(x=>\(\{x,type:'role'\}\)\)/);
  assert.match(app, /snap\.wechat\.phoneFriends\|\|\[\]\)\.map\(x=>\(\{x,type:'phoneFriend'\}\)\)/);
  assert.match(app, /snap\.wechat\.groups\|\|\[\]\)\.map\(x=>\(\{x,type:'group'\}\)\)/);
  assert.match(app, /snap\.moments\.forEach\(x=>add\('moments'/);
  assert.match(app, /snap\.xDms\.forEach\(x=>add\('x'/);
  assert.match(app, /snap\.douyinDms\.forEach\(x=>add\('douyin'/);
  for (const target of ['最近通话', '短信', '语音留言', '通讯录', '浏览记录', '购物订单', '外卖订单', '云程机票', '日历日程', '信箱邮件', '任务便签', '线下约会', '音乐聊天', '钱包账单', '小事簿', '位置', '电量']) {
    assert.match(app, new RegExp(target));
  }
  assert.match(app, /a\.targetType==='role'/);
  assert.match(app, /a\.targetType==='xDm'/);
  assert.match(app, /a\.targetType==='dyDm'/);
});

test('remote subtitles are one at a time and every visible line comes from the role API', () => {
  assert.match(app, /function remoteControlRoleLines\(c,a,r\)/);
  assert.match(app, /await chatAPI\(\[\{role:'system',content:buildSystem\(c\)\}/);
  assert.match(app, /await remoteControlShowRoleLines\(await remoteControlRoleLines\(c,a,r\)\)/);
  assert.match(app, /cap\.replaceChildren\(b\)/);
  assert.doesNotMatch(app, /function remoteControlSayFallback/);
  assert.match(app, /function remoteControlCaptionMs\(t\)\{return Math\.max\(4600/);
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
