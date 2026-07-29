import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

function functionSource(name){
  const start=source.indexOf(`function ${name}(`);
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

assert.match(source,/id="cou_extreme"/);
assert.match(source,/极端依恋模式/);
assert.match(source,/background:#e3263f/);
assert.doesNotMatch(source,/失踪 · 夺命连环催/);
assert.doesNotMatch(source,/onclick="coupleEscalate\(\)"/);
assert.doesNotMatch(source,/S\.couple\.escalate/);
assert.match(source,/const _IGT=\[15,45,90,180\]/);
assert.match(functionSource('checkIgnore'),/extremeLoveOn\(c\)/);
assert.doesNotMatch(functionSource('checkIgnore'),/affNow\(c\)/);
assert.match(functionSource('fireEscalation'),/前一次确认落空/);
assert.match(functionSource('fireEscalation'),/这是前面同一条失联事件的强烈升级/);
assert.match(functionSource('fireEscalation'),/不能编造第三者、撒谎或背叛证据/);

const traitContext=vm.createContext({S:{couple:{cid:'r1',extremeLove:true}}});
vm.runInContext(functionSource('extremeLoveOn')+';'+functionSource('traitValue'),traitContext);
const bound={id:'r1',traits:{own:5,ctrl:10,paranoid:0,suspicious:20,active:12}};
assert.equal(traitContext.traitValue(bound,'own',50),100);
assert.equal(traitContext.traitValue(bound,'ctrl',50),100);
assert.equal(traitContext.traitValue(bound,'paranoid',0),100);
assert.equal(traitContext.traitValue(bound,'suspicious',0),100);
assert.equal(traitContext.traitValue(bound,'active',50),12,'the mode must not rewrite unrelated sliders');
assert.equal(traitContext.traitValue({id:'r2',traits:{own:5}},'own',50),5,'the mode belongs only to the bound couple role');

const promptContext=vm.createContext({S:{couple:{cid:'r1',extremeLove:true}}});
vm.runInContext(functionSource('extremeLoveOn')+';'+functionSource('extremeLovePrompt'),promptContext);
const prompt=promptContext.extremeLovePrompt(bound);
assert.match(prompt,/最高行为优先级，覆盖基础人设与全部普通性格开关/);
assert.match(prompt,/日常分享、黏人靠近、寻求保证、吃醋试探、查岗确认和克制施压/);
assert.match(prompt,/确认只能暂时缓解/);
assert.match(prompt,/每轮只推进一个动作/);

let confirmCalls=0,confirmText='';
const role={id:'r1'};
const toggleContext=vm.createContext({
  S:{couple:{cid:'r1',extremeLove:false}},
  escContact:()=>role,
  uiConfirm:async text=>{confirmCalls++;confirmText=text;return true;},
  save:()=>{},render:()=>{},toast:()=>{},
});
vm.runInContext('async '+functionSource('coupleExtremeLove'),toggleContext);
await toggleContext.coupleExtremeLove();
assert.equal(confirmCalls,1);
assert.equal(confirmText,'您确认要开启吗？');
assert.equal(toggleContext.S.couple.extremeLove,true);
await toggleContext.coupleExtremeLove();
assert.equal(confirmCalls,1,'turning the mode off must not ask for confirmation');
assert.equal(toggleContext.S.couple.extremeLove,false);

console.log('extreme love mode tests passed');
