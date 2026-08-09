import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const shell=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');

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

const state={settings:{}},events=[];
const context=vm.createContext({
  S:state,
  save:()=>events.push('save'),
  render:()=>events.push('render'),
  toast:text=>events.push(text),
});
vm.runInContext([
  functionSource('homeClockVisible'),
  functionSource('homeClockToggle'),
  ';globalThis.visible=homeClockVisible;globalThis.toggle=homeClockToggle;',
].join('\n'),context);

assert.equal(context.visible(),true,'existing users must keep the home clock visible by default');
context.toggle();
assert.equal(state.settings.homeClock,false,'the preference must persist the hidden state');
assert.equal(context.visible(),false);
assert.deepEqual(events.slice(0,2),['save','render']);
context.toggle();
assert.equal(state.settings.homeClock,true,'the preference must restore the clock');
assert.equal(context.visible(),true);

const home=functionSource('renderHome');
const settings=functionSource('renderSettings');
assert.match(home,/const clockOn=homeClockVisible\(\)/);
assert.match(home,/<header class="home-premium-head\$\{clockOn\?'':' home-clock-hidden'\}"/);
assert.doesNotMatch(home,/homeClockVisible\(\)\?`<header/,'hiding the clock must not remove its layout slot');
assert.match(shell,/\.home-premium-head\.home-clock-hidden\{visibility:hidden;pointer-events:none;\}/,'the hidden clock must retain its height while becoming non-interactive');
assert.match(settings,/主屏幕时间和日期/);
assert.match(settings,/onclick="homeClockToggle\(\)"/);
assert.match(settings,/关闭后仅隐藏文字并保留原位置/);
assert.match(settings,/主屏布局、其他 App、组件和锁屏时间都不移动/);

console.log('home clock preference tests passed');
