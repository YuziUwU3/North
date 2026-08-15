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

const context=vm.createContext({WECHAT_UNIFIED_SYSTEM:true,String});
vm.runInContext([
  functionSource('wechatNaturalOn'),
  functionSource('wechatNaturalCallEventNote'),
  functionSource('wechatNaturalSilentDecision'),
  functionSource('wechatNaturalSlimSystem'),
  ';globalThis.enabled=wechatNaturalOn;globalThis.note=wechatNaturalCallEventNote;globalThis.silent=wechatNaturalSilentDecision;globalThis.slim=wechatNaturalSlimSystem;',
].join('\n'),context);

assert.equal(context.enabled(),true,'the unified system must be the only default');
const sample='基础人设\n\n# 申请远程操控小手机\n远控规则\n\n# 你对玩家手机App的管控权\n锁软件规则\n\n# 微信聊天规则\n基本格式';
assert.match(context.slim(sample,{natural:true,query:'早上好'}),/远控规则|锁软件规则/,'capabilities must not disappear from ordinary turns');
assert.match(context.note(),/做出一次看得见的自然反应/);
assert.match(context.note(),/不能只输出 \[保持安静\]/);
assert.equal(context.silent('[保持安静]',context.note()),false,'call events may no longer vanish silently');

assert.match(source,/function adjMood\(id,d\)\{const c=getC/,'mood updates must stay active');
assert.match(source,/if\(moodProbeText\(_lu&&msgToText\(_lu\)\)/,'mood follow-up repair must stay active');
assert.match(source,/mm=line\.match\(\/\^\\\[心情值[\s\S]{0,120}\{adjMood\(id/,'mood delta tags must be consumed');
assert.match(source,/_relIntent=replyAccount!=='main'\?null:relationshipIntent/,'relationship policy is restored only for the main account');
assert.match(source,/maybeAffectionShift\(id,c,_lu,content\);/,'relationship progression must stay active');
assert.match(source,/dialogueEmotionOnReply\(c,content,_userText\);/,'dialogue emotion continuity must stay active');
assert.match(source,/if\(_main\)\{const mv=moodNow\(c\);/,'current mood context must be present');
assert.match(source,/if\(_main\)\{const _cl=/,'emotion cooldown must be present');
assert.match(source,/if\(_main&&c\.emotionTailUntil/,'emotion tail must be present');
assert.match(source,/\{const _ap=currentActivityPrompt\(c\);/,'stable current activity must be present');
assert.match(source,/function checkIgnore\(\)\{if\(/);
assert.doesNotMatch(functionSource('checkIgnore'),/wechatNaturalOn/,'no-reply checks must not be disabled by the retired mode');
assert.doesNotMatch(functionSource('handleIdleEvent'),/wechatNaturalOn/,'idle events must not be discarded');
assert.doesNotMatch(functionSource('handleExternalEvent'),/wechatNaturalOn/,'external events must not be discarded');
assert.doesNotMatch(functionSource('recordTaMood'),/wechatNaturalOn/,'daily mood records must remain available');
assert.doesNotMatch(functionSource('suspicionTick'),/wechatNaturalOn/,'suspicion follow-through must remain available');
assert.doesNotMatch(functionSource('behaviorRecord'),/wechatNaturalOn/,'behavior evidence must remain available');
assert.match(source,/if\(_main&&!_natural\)\{const gd=/,'the unselected grudge ledger remains excluded from the fused behavior');
assert.match(source,/if\(_main&&!_natural&&!opt\.selectiveMemory\)\{const _pd=powerDynamicPrompt/,'the unselected power\/BDSM controller remains excluded');
assert.match(source,/# 角色内心想法（仅展示，不控制角色）/);
assert.match(source,/不是心情值，不改变任何数值、亲密度、行为权限或自主决定/);
assert.match(source,/role:_naturalOn&&m\.type==='sys'\?'system':m\.role/,'system events must not masquerade as user speech');
assert.match(source,/是否舍不得挂电话必须由你本人的性格、当前关系和真实通话决定/,'call clinginess must be character-led');
assert.match(source,/对方明确有事、很困、要停止或重复提出挂断时必须尊重/,'clinginess must have a hard stop boundary');
assert.match(source,/content=applyControlTags\(content,c,id,_statedPwd\)/,'lock and control execution remains connected');

console.log('WeChat unified autonomy tests passed');
