import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

function functionSource(name){
  const start=source.indexOf(`function ${name}(`);
  assert.ok(start>=0,`missing ${name}`);
  const brace=source.indexOf('{',start);let depth=0,quote='',escape=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escape)escape=false;else if(ch==='\\')escape=true;else if(ch===quote)quote='';continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

test('saying I am going to use Douyin is not treated as a phone inspection request',()=>{
  const sandbox={String,rolePhoneTelemetryCategories:()=>[],rolePhoneFocusFromCategories:()=>''};
  vm.runInNewContext([
    functionSource('companionInspectionFocusFromText'),
    functionSource('userPersonalAppUseStatement'),
    functionSource('companionInspectionRequestFromUser'),
    'globalThis.personal=userPersonalAppUseStatement;globalThis.request=companionInspectionRequestFromUser;'
  ].join('\n'),sandbox);
  assert.equal(sandbox.personal('那我去刷刷抖音了'),true);
  assert.equal(sandbox.request('那我去刷刷抖音了'),'');
  assert.equal(sandbox.request('我先去看看小红书'), '');
  assert.equal(sandbox.request('你查一下我的抖音'),'抖音');
  assert.equal(sandbox.request('帮我查看抖音数据'),'抖音');
});

test('the preflight inspection lane keeps personal app-use messages in normal reply flow',()=>{
  assert.match(functionSource('maybeSpyIntent'),/!heWants&&userPersonalAppUseStatement\(userText\)\)return false/);
});
