import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
function fn(name){const start=source.indexOf(`function ${name}`);assert.ok(start>=0,`missing ${name}`);const brace=source.indexOf('{',start);let depth=0,quote='',escaped=false;for(let i=brace;i<source.length;i++){const ch=source[i];if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return source.slice(start,i+1);}throw new Error(`unterminated ${name}`);}

test('connected calls and role-ended calls never create voicemail',()=>{
  assert.doesNotMatch(fn('hangupCall'),/phAdd(?:Role)?Voicemail/);
  assert.doesNotMatch(fn('phRoleEndSimCall'),/phAdd(?:Role)?Voicemail/);
  const simulated=fn('phSimHangup');
  const active=simulated.slice(simulated.indexOf("if(c.state==='active')"),simulated.indexOf("else if(c.state==='calling')"));
  assert.doesNotMatch(active,/phAdd(?:Role)?Voicemail/);
});

test('outgoing cancellation cannot leave voicemail',()=>{
  assert.doesNotMatch(fn('declineCall'),/phAddRoleVoicemail/);
  assert.match(fn('phAddRoleVoicemail'),/if\(!\['missed','decline'\]\.includes\(opt\.why\)\)return''/);
  assert.doesNotMatch(source,/why:'(?:hangup|canceled|role_hangup|role_block)'/);
});

test('legacy robotic and duplicate voicemail is repaired',()=>{
  const cleared=[];
  const context=vm.createContext({clearVoiceAudio:v=>cleared.push(v.id),setTimeout:()=>{},save:()=>{}});
  for(const name of ['phDigits','phNorm','phVmNorm','phRepairVoicemailPolicy'])vm.runInContext(fn(name),context);
  const p={voicemail:[
    {id:'bad',num:'100',roleId:'r1',text:'We did not finish that call. Call me back.'},
    {id:'old',num:'100',roleId:'r1',text:'刚才没联系上你，忙完回我一下。'},
    {id:'new',num:'100',roleId:'r1',text:'刚才没联系上你，忙完回我一下。'},
    {id:'ok',num:'100',roleId:'r1',text:'今天下雨了，出门带伞。'}
  ]};
  assert.equal(context.phRepairVoicemailPolicy(p),true);
  assert.equal(Array.from(p.voicemail,v=>v.id).join(','),'new,ok');
  assert.deepEqual(cleared.sort(),['bad','old']);
});
