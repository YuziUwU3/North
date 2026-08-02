import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

function functionSource(name){
  const start=source.indexOf(`function ${name}`);
  assert.ok(start>=0,`missing ${name}`);
  const brace=source.indexOf('{',start);
  let depth=0,quote='',escaped=false,regex=false,regexClass=false,prev='';
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(regex){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='[')regexClass=true;else if(ch===']')regexClass=false;else if(ch==='/'&&!regexClass)regex=false;continue;}
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='/'&&source[i+1]!=='/'&&source[i+1]!=='*'&&/[=(,:;!&|?\[{]/.test(prev)){regex=true;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
    if(!/\s/.test(ch))prev=ch;
  }
  throw new Error(`unterminated ${name}`);
}

const mediaElement=functionSource('uiToneElement');
const mediaWake=functionSource('audioMediaWake');
const mediaTone=functionSource('playMediaTone');

assert.match(mediaElement,/_audioMediaPrimer/,'iOS UI sounds must reuse one persistent media element');
assert.match(mediaTone,/uiToneElement\(\)/);
assert.match(mediaTone,/a\.play\(\)/);
assert.match(mediaTone,/webToneSequence/,'Web Audio remains a fallback only');
assert.match(mediaWake,/uiToneElement\(\)/,'touch wake must prime the same element later used for UI sounds');
assert.doesNotMatch(mediaWake,/new Audio\(/,'touch wake must not unlock a disposable element on iOS');
assert.doesNotMatch(mediaWake,/removeAttribute\(['"]src/,'the primed iOS element must remain reusable');
assert.match(functionSource('playDing'),/playMediaTone/);
assert.match(functionSource('phSound'),/playMediaTone/);
assert.match(functionSource('ringStart'),/playMediaTone/);
assert.match(functionSource('ringStart'),/loop:true/);

assert.doesNotMatch(source,/# 标点和口吻（必须遵守）/);
assert.equal(functionSource('cleanRolePunct'),"function cleanRolePunct(t){return String(t||'');}");

console.log('iOS UI audio and natural punctuation tests passed');
