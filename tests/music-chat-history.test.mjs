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
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

const context=vm.createContext({
  S:{
    contacts:[
      {id:'active',name:'仍在的角色',deleted:false},
      {id:'deleted',name:'已删角色',deleted:true},
    ],
    music:{songs:[],chat:[
      {cid:'active',role:'assistant',content:'保留'},
      {cid:'deleted',role:'assistant',content:'隐藏'},
      {cid:'missing',role:'assistant',content:'孤立'},
    ]},
  },
});

vm.runInContext(functionSource('musicInit'),context);
vm.runInContext(functionSource('musicChatContacts'),context);
vm.runInContext(functionSource('musicChatRows'),context);

assert.deepEqual(Array.from(context.musicChatContacts(),c=>c.id),['active']);
assert.deepEqual(Array.from(context.musicChatRows(),m=>m.content),['保留']);
assert.deepEqual(Array.from(context.musicChatRows('active'),m=>m.content),['保留']);
assert.equal(context.musicChatRows('deleted').length,0);

const home=functionSource('renderMusicHome');
assert.doesNotMatch(home,/<em>\$\{chatCount/);
assert.match(functionSource('musicChatHistoryModal'),/onchange="musicChatHistoryModal\(this\.value\)"/);

console.log('music chat history tests passed');
