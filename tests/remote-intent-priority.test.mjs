import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
function fn(name){const markers=[`function ${name}(`,`async function ${name}(`];const start=Math.max(...markers.map(x=>source.indexOf(x)));assert.ok(start>=0,`missing ${name}`);const brace=source.indexOf('{',start);let depth=0,quote='',escaped=false;for(let i=brace;i<source.length;i++){const ch=source[i];if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return source.slice(start,i+1);}throw new Error(`unterminated ${name}`);}

function context(intent){const sandbox={_remoteCtl:{cid:'r1',intentContext:'',declaredIntent:intent},remoteControlIntentContext:()=>'',phoneInspectionFriendRejectIntent:t=>/拒绝|驳回|不通过/.test(t),console};vm.createContext(sandbox);for(const name of ['remoteControlDeclaredIntent','remoteControlIntentFocus','remoteControlFocusedPlan','remoteControlIntentPriority'])vm.runInContext(`${fn(name)};globalThis.${name}=${name};`,sandbox);return sandbox;}
const rows=[
  {app:'x',targetType:'xPost'},
  {app:'phoneapp',targetType:'phoneCalls'},
  {app:'phoneapp',targetType:'phoneContacts'},
  {app:'wechat',targetType:'wechatList'},
  {app:'wechat',targetType:'newFriendList'},
  {app:'douyin',targetType:'dyHome'},
  {app:'douyin',targetType:'dySearchHistory'},
];

test('the role-declared phone address book is the first actual target',()=>{
  const c=context('我先打开通讯录，看看里面的人');
  const planned=c.remoteControlFocusedPlan({id:'r1'},rows);
  const ordered=c.remoteControlIntentPriority({id:'r1'},planned);
  assert.equal(ordered[0].app,'phoneapp');
  assert.equal(ordered[0].targetType,'phoneContacts');
  assert.equal(ordered.filter(x=>x.app==='phoneapp').length,1);
});

test('rejecting a friend request strictly starts from WeChat new friends',()=>{
  const c=context('我最在意通讯录里的新朋友，先进去把那个人拒绝');
  const planned=c.remoteControlFocusedPlan({id:'r1'},rows);
  assert.deepEqual(JSON.parse(JSON.stringify(planned)),[{app:'wechat',targetType:'newFriendList'}]);
});

test('a precise Douyin target is opened before every other mentioned app',()=>{
  const c=context('微博之后再说，我最在意抖音搜索记录，先打开它');
  const planned=c.remoteControlFocusedPlan({id:'r1'},rows);
  const ordered=c.remoteControlIntentPriority({id:'r1'},planned);
  assert.equal(ordered[0].app,'douyin');
  assert.equal(ordered[0].targetType,'dySearchHistory');
  assert.equal(ordered.filter(x=>x.app==='douyin').length,1);
});
