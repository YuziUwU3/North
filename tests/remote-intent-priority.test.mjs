import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
function fn(name){const start=source.indexOf(`function ${name}`);assert.ok(start>=0,`missing ${name}`);const brace=source.indexOf('{',start);let depth=0,quote='',escaped=false;for(let i=brace;i<source.length;i++){const ch=source[i];if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return source.slice(start,i+1);}throw new Error(`unterminated ${name}`);}

function run(intent){const context=vm.createContext({_remoteCtl:{cid:'r1',intentContext:intent},remoteControlIntentContext:()=>'',console});vm.runInContext(fn('remoteControlIntentPriority'),context);const rows=[
  {app:'x',targetType:'xPostList'},
  {app:'phoneapp',targetType:'phoneCalls'},
  {app:'phoneapp',targetType:'phoneContacts'},
  {app:'wechat',targetType:'wechatList'},
  {app:'wechat',targetType:'newFriendList'}
];return context.remoteControlIntentPriority({id:'r1'},rows);}

test('explicit phone address-book goal opens contacts first',()=>{
  const rows=run('我要查看你的通讯录');
  assert.equal(rows[0].app,'phoneapp');
  assert.equal(rows[0].targetType,'phoneContacts');
});

test('friend-request goal opens WeChat new friends first',()=>{
  const rows=run('去新的朋友里拒绝好友申请');
  assert.equal(rows[0].app,'wechat');
  assert.equal(rows[0].targetType,'newFriendList');
});
