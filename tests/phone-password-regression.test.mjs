import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

function functionSource(name){
  const start=source.indexOf(`function ${name}`);
  assert.ok(start>=0,`missing ${name}`);
  const brace=source.indexOf('{',start);
  let depth=0,quote='',escaped=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

const spy={pwd:'1111'},unlock={r1:true};
const context=vm.createContext({
  getSpy:()=>spy,
  _spyUnlock:unlock,
  Math,
});
vm.runInContext([
  functionSource('rolePhonePasswordIntent'),
  functionSource('rolePhonePasswordApply'),
  ';globalThis.intent=rolePhonePasswordIntent;globalThis.apply=rolePhonePasswordApply;',
].join('\n'),context);

assert.equal(context.intent('我把手机密码改成 4826 了。'),'4826');
assert.equal(context.intent('密码还是1111，没改。'),'','a statement that the password did not change must not mutate it');
assert.equal(context.intent('我把解锁密码换了。'),'random');
assert.equal(context.apply({id:'r1'},'4826'),true);
assert.equal(spy.pwd,'4826','a role-spoken explicit password must replace the old password');
assert.equal(unlock.r1,false,'changing the password must invalidate the previous unlocked session');

const control=functionSource('applyControlTags');
assert.match(control,/rolePhonePasswordIntent\(content\)/);
assert.match(control,/rolePhonePasswordApply\(c,naturalPhonePwd\)/);
assert.match(control,/phonePwdChanged/);

console.log('phone password regression tests passed');
