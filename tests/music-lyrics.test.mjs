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

const context=vm.createContext({});
vm.runInContext(functionSource('parseLyrics'),context);
vm.runInContext(functionSource('musicLyricIndex'),context);

const lines=context.parseLyrics('[00:01.250]第一句\n[00:02.75]第二句\n[00:03,005]第三句');
assert.equal(lines.length,3);
assert.equal(lines[0].t,1.25,'three digit milliseconds must stay readable');
assert.equal(lines[1].t,2.75);
assert.equal(lines[2].t,3.005);
assert.equal(context.musicLyricIndex(lines,1.24),0,'small media event jitter must not leave the next lyric dark');
assert.equal(context.musicLyricIndex(lines,2.75),1);
assert.equal(context.musicLyricIndex(lines,3.1),2);

console.log('music lyrics tests passed');
