import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=source.indexOf('function wechatAuxConfigured()');
const end=source.indexOf('async function aiReply(id,note,replyToken,replyAccount,replyIntent)',start);
assert.ok(start>=0&&end>start,'wechat fallback helpers must exist');

assert.match(source,/具体约会只能使用本轮已选中的一条相关记忆/);
assert.doesNotMatch(source,/_off\.memory\.map\(offMemText\)/);
assert.match(source,/let content=await wechatPrimaryReply\(\[\{role:'system',content:_sys\},\.\.\.hist,_pin\],_md,_routeState\)/);
assert.match(source,/wechatRoleDrift\(content\)&&!_routeState\.fallback/);
assert.match(source,/_repairMd=Object\.assign\(\{\},_md,\{aux:c\.model==='aux'\|\|wechatAuxConfigured\(\)\}\)/);

const calls=[];
const sandbox={
  S:{settings:{aux:{model:'backup-model'}}},
  mode:'normal',
  async chatAPI(_messages,md){
    calls.push(!!md.aux);
    if(sandbox.mode==='throw'&&!md.aux)throw new Error('primary failed');
    if(sandbox.mode==='empty'&&!md.aux)return '';
    return md.aux?'aux reply':'main reply';
  },
  isRefusal:t=>/refusal/i.test(String(t||'')),
  splitBubbles:t=>String(t||'').split('\n'),
  isOOCLine:t=>/^OOC/.test(String(t||'')),
};
vm.runInNewContext(source.slice(start,end),sandbox);

let state={fallback:false};
assert.equal(await sandbox.wechatPrimaryReply([], {aux:false}, state),'main reply');
assert.deepEqual(calls.splice(0),[false]);
assert.equal(state.fallback,false);

sandbox.mode='throw';state={fallback:false};
assert.equal(await sandbox.wechatPrimaryReply([], {aux:false}, state),'aux reply');
assert.deepEqual(calls.splice(0),[false,true]);
assert.equal(state.fallback,true);

sandbox.mode='empty';state={fallback:false};
assert.equal(await sandbox.wechatPrimaryReply([], {aux:false}, state),'aux reply');
assert.deepEqual(calls.splice(0),[false,true]);
assert.equal(state.fallback,true);

sandbox.S.settings.aux.model='';sandbox.mode='throw';state={fallback:false};
await assert.rejects(()=>sandbox.wechatPrimaryReply([], {aux:false}, state),/primary failed/);
assert.deepEqual(calls.splice(0),[false]);
assert.equal(state.fallback,false);

assert.equal(sandbox.wechatRoleDrift('normal reply'),false);
assert.equal(sandbox.wechatRoleDrift('refusal'),true);
assert.equal(sandbox.wechatRoleDrift('OOC: assistant'),true);

console.log('wechat fallback routing tests passed');
