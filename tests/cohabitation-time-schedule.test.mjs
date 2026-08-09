import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');

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

test('the shared role schedule distinguishes weekdays from weekends',()=>{
  const sandbox={Date,Math,String};
  vm.runInNewContext([
    functionSource('toMin'),functionSource('weekdayCN'),functionSource('roleWorkday'),
    functionSource('activityHash'),functionSource('activityPick'),
    functionSource('whereNow'),functionSource('activitySpec'),
    'globalThis.spec=activitySpec;globalThis.where=whereNow;'
  ].join('\n'),sandbox);
  const role={id:'c1',job:'医生',sched:{on:true,work:'医院',home:'家',amS:'08:00',amE:'12:00',pmS:'14:00',pmE:'18:00'}};
  const monday=new Date(2026,7,10,9,0,0);
  const sunday=new Date(2026,7,9,9,0,0);
  assert.equal(sandbox.spec(role,monday).key,'work-am');
  assert.match(sandbox.where(role,monday),/医院.*上班/);
  assert.equal(sandbox.spec(role,sunday).key,'weekend-morning');
  assert.doesNotMatch(sandbox.where(role,sunday),/上班|公司|医院/);
});

test('time awareness pins today, yesterday and tomorrow to the real calendar',()=>{
  const fixed=new Date(2026,7,10,3,5,0).getTime();
  class FakeDate extends Date{constructor(...args){super(...(args.length?args:[fixed]));}static now(){return fixed;}}
  const sandbox={Date:FakeDate,String};
  vm.runInNewContext([
    functionSource('hm'),functionSource('weekdayCN'),functionSource('ymdFull'),
    functionSource('dayPartNow'),functionSource('timeAwarenessPrompt'),
    'globalThis.prompt=timeAwarenessPrompt;'
  ].join('\n'),sandbox);
  const prompt=sandbox.prompt('用户','cohab');
  assert.match(prompt,/2026年8月10日 周一 03:05/);
  assert.match(prompt,/今天是周一，昨天是周日，明天是周二/);
  assert.doesNotMatch(prompt,/明天是周日/);
  assert.match(prompt,/共同生活里最高优先级事实/);
});

test('common life shows a live calendar and reuses the editable role schedule',()=>{
  const system=functionSource('cohabSystem'),panel=functionSource('cohabSettingsPanel'),render=functionSource('renderCohab');
  assert.match(system,/timeAwarenessPrompt\(S\.me\.name,'cohab'\)/);
  assert.match(system,/roleSchedulePrompt\(c\)/);
  assert.match(system,/真正离开后再输出上班状态/);
  assert.match(panel,/作息时间表/);
  assert.match(panel,/schedSet\('\$\{id\}'\)/);
  assert.match(render,/id="cohabLiveTime"/);
  assert.match(source,/cohabClock\.textContent=cohabClockText\(\)/);
  assert.match(html,/\.cohab-meta time\{/);
});
