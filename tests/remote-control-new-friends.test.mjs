import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

function fn(name){
  const starts=[source.indexOf(`function ${name}(`),source.indexOf(`async function ${name}(`)].filter(x=>x>=0);
  assert.ok(starts.length,`missing ${name}`);
  const start=Math.min(...starts),brace=source.indexOf('{',start);let depth=0,quote='',escaped=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

test('the v728 remote core stays character-driven with no forced rejection route',()=>{
  const route=fn('routePhoneInspectionTags');
  assert.doesNotMatch(source,/reject_friend_requests|remoteControlForcedFriendRejectPlan|phoneInspectionFriendRejectIntent/);
  assert.doesNotMatch(source,/拒绝新的朋友申请（入口硬规则）/);
  assert.doesNotMatch(route,/新朋友|好友申请|拒绝/);
  assert.match(source,/最终用哪种方式查由你自己决定/);
  assert.match(source,/没有想拒绝的就返回空数组/);
});

test('new-friend handling uses the real WeChat Friends path in order',()=>{
  const enter=fn('remoteControlEnterNewFriends');
  const chats=enter.indexOf("wxTab='chats'");
  const wechat=enter.indexOf("remoteControlSetPage('wechat')");
  const friendTab=enter.indexOf("includes('好友')");
  const tabClick=enter.indexOf('tab.click()');
  const newFriendRow=enter.indexOf("==='新的朋友'");
  const rowClick=enter.indexOf('row.click()');
  assert.ok(chats>=0&&wechat>chats&&friendTab>wechat&&tabClick>friendTab&&newFriendRow>tabClick&&rowClick>newFriendRow);
  assert.doesNotMatch(enter,/phoneapp|通讯录/);
  assert.match(enter,/cur\(\)\.p==='newfriends'/);
});

test('a rejection only succeeds after clicking the visible reject button',()=>{
  const prepare=fn('remoteControlPrepareFriendReject');
  const execute=fn('remoteControlExecute');
  const run=fn('remoteControlRun');
  assert.match(prepare,/\.nf-card\.pending/);
  assert.match(prepare,/button\.reject/);
  assert.match(prepare,/preparedFriendReject=\{rid:a\.targetId,button:btn\}/);
  assert.match(execute,/prepared\.button\.click\(\)/);
  assert.match(execute,/req\.status!=='rejected'/);
  assert.match(execute,/好友 → 新的朋友/);
  assert.match(run,/if\(!await remoteControlEnterNewFriends\(\)\)continue/);
  assert.match(run,/if\(!await remoteControlPrepareFriendReject\(a\)\)continue/);
});

test('the role may select some pending requests or select none',()=>{
  const candidates=fn('remoteControlNewFriendRequests');
  const choice=fn('remoteControlNewFriendChoicePlan');
  assert.match(candidates,/r\.status==='pending'/);
  assert.match(candidates,/friendRequestVisible\(r\)/);
  assert.match(candidates,/r\.contactId!==actorId/);
  assert.match(choice,/决定权始终是你自己的/);
  assert.match(choice,/不要因为用户提过“拒绝”就机械执行/);
  assert.match(choice,/没有想拒绝的就返回空数组/);
  assert.match(choice,/catch\(e\)\{return\[\];\}/);
  assert.doesNotMatch(choice,/必须至少拒绝|slice\(0,1\)/);
});

test('the rejection record is idempotent and remains available for the 24-hour history',()=>{
  const contact={id:'visitor',name:'来访者'};let saves=0;
  const context=vm.createContext({Date,S:{friendRequests:[{id:'req-1',contactId:contact.id,status:'pending',kind:'created',attempt:1}]},friendRequestsInit:()=>{},getC:id=>id===contact.id?contact:null,friendMainBlocked:()=>false,friendRetryAfterIgnore:()=>{throw new Error('must not retry');},save:()=>{saves++;}});
  vm.runInContext(`${fn('rejectFriendRequestRecord')};globalThis.rejectFriendRequestRecord=rejectFriendRequestRecord;`,context);
  const first=context.rejectFriendRequestRecord('req-1');
  assert.equal(first.contact,contact);
  assert.equal(context.S.friendRequests[0].status,'rejected');
  assert.equal(context.rejectFriendRequestRecord('req-1'),null);
  assert.equal(saves,1);
  assert.match(source,/status==='rejected'&&now-\(\+r\.decidedAt\|\|r\.time\)>=86400000/);
});
