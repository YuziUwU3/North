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

function remoteSection(){
  const start=source.indexOf('let _remoteCtl=');
  const end=source.indexOf('let _wxLoginTimer=',start);
  assert.ok(start>=0&&end>start);
  return source.slice(start,end);
}

test('friend-request rejection is absent from remote control',()=>{
  const remote=remoteSection();
  for(const token of ['reject_friend_request','newFriendList','remoteControlNewFriend','remoteControlEnterNewFriends','remoteControlPrepareFriendReject']){
    assert.doesNotMatch(remote,new RegExp(token));
  }
  assert.doesNotMatch(fn('remoteControlRun'),/newFriend|FriendReject/);
});

test('WeChat login exposes only real pending requests',()=>{
  const pending=fn('wxLoginPendingFriendRequests');
  const prompt=fn('wxLoginPendingFriendPrompt');
  assert.match(pending,/r\.status==='pending'/);
  assert.match(pending,/friendRequestVisible\(r\)/);
  assert.match(pending,/r\.contactId!==cid/);
  assert.match(prompt,/wxLoginPendingFriendRequests\(cid\)/);
  assert.match(prompt,/JSON\.stringify\(rows\)/);
  assert.match(prompt,/\[拒绝新朋友\|申请key\]/);
  assert.match(prompt,/一个都不拒绝也可以/);
  assert.match(prompt,/不要机械全拒/);
});

test('rejection is gated to the currently logged-in character and uses the visible button handler',()=>{
  const reject=fn('wxLoginRejectPendingFriend');
  assert.match(reject,/!wxLoginActive\(\)\|\|!S\.wxLogin\|\|S\.wxLogin\.by!==cid/);
  assert.match(reject,/ignoreFriend\(rid\)/);
  assert.match(reject,/req\.status!=='rejected'/);
  assert.match(reject,/wxLoginRecordAction\(c,'reject_request'/);
  assert.match(fn('wxLoginSession'),/wxLoginRejectPendingFriend\(cid,m\[1\]\.trim\(\)\)/);
  assert.match(source,/onclick="event\.stopPropagation\(\);ignoreFriend\('\$\{r\.id\}'\)"/);
});

test('the login rejection cannot run before login or for another character',()=>{
  const actor={id:'actor',name:'Actor'};
  const other={id:'other',name:'Other'};
  const visitor={id:'visitor',name:'Visitor'};
  let ignoreCalls=0,recordCalls=0;
  const context=vm.createContext({
    Date,
    S:{wxLogin:null,friendRequests:[{id:'req-1',contactId:'visitor',status:'pending',time:Date.now()}]},
    friendRequestsInit:()=>{},
    friendRequestVisible:()=>true,
    friendReqText:x=>x||'',
    factStamp:()=>'',
    getC:id=>({actor,other,visitor}[id]||null),
    ignoreFriend:rid=>{ignoreCalls++;const r=context.S.friendRequests.find(x=>x.id===rid);if(r)r.status='rejected';},
    wxLoginRecordAction:()=>{recordCalls++;}
  });
  vm.runInContext(`${fn('wxLoginActive')};${fn('wxLoginPendingFriendRequests')};${fn('wxLoginRejectPendingFriend')};globalThis.reject=wxLoginRejectPendingFriend;`,context);
  assert.equal(context.reject('actor','req-1'),null);
  context.S.wxLogin={by:'other',until:Date.now()+60000,did:[]};
  assert.equal(context.reject('actor','req-1'),null);
  assert.equal(ignoreCalls,0);
  context.S.wxLogin={by:'actor',until:Date.now()+60000,did:[]};
  const hit=context.reject('actor','req-1');
  assert.equal(hit.key,'req-1');
  assert.equal(context.S.friendRequests[0].status,'rejected');
  assert.equal(ignoreCalls,1);
  assert.equal(recordCalls,1);
  assert.equal(context.reject('actor','req-1'),null);
  assert.equal(ignoreCalls,1);
});

test('the rejection record remains idempotent and expires after 24 hours',()=>{
  const contact={id:'visitor',name:'Visitor'};let saves=0;
  const context=vm.createContext({Date,S:{friendRequests:[{id:'req-1',contactId:contact.id,status:'pending',kind:'created',attempt:1}]},friendRequestsInit:()=>{},getC:id=>id===contact.id?contact:null,friendMainBlocked:()=>false,friendRetryAfterIgnore:()=>{throw new Error('must not retry');},save:()=>{saves++;}});
  vm.runInContext(`${fn('rejectFriendRequestRecord')};globalThis.rejectFriendRequestRecord=rejectFriendRequestRecord;`,context);
  const first=context.rejectFriendRequestRecord('req-1');
  assert.equal(first.contact,contact);
  assert.equal(context.S.friendRequests[0].status,'rejected');
  assert.equal(context.rejectFriendRequestRecord('req-1'),null);
  assert.equal(saves,1);
  assert.match(source,/status==='rejected'&&now-\(\+r\.decidedAt\|\|r\.time\)>=86400000/);
});
