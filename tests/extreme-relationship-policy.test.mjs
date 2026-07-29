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

const aiReply=functionSource('aiReply');
assert.match(aiReply,/relationshipIntent\(c,note,_userText\)/);
assert.match(aiReply,/relationshipPolicyPrompt\(c,_relIntent\)/);
assert.match(aiReply,/relationshipCheck\(c,_relIntent,content\)/);
assert.match(aiReply,/relationshipRewriteNote\(_relIntent,_rc\)/);
assert.match(aiReply,/relationshipFallback\(c,_relIntent\)/);
assert.match(aiReply,/relationshipCommit\(c,_relIntent,content\)/);

const relationshipContext=vm.createContext({
  S:{},
  save:()=>{},
  msgs:()=>[],
  msgToText:m=>m.content||'',
  suspicionState:c=>c.state,
});
vm.runInContext([
  functionSource('relationshipNorm'),
  functionSource('relationshipScore'),
  functionSource('relationshipRecentTurns'),
  functionSource('relationshipDuplicate'),
  functionSource('relationshipCheck'),
  functionSource('relationshipCommit'),
].join(';'),relationshipContext);

const role={id:'r1',state:{relationshipTurns:[],relationshipTurn:0}};
const hangup={kind:'hangup',eventId:'h1',summary:'拒接了你打来的语音电话',hard:true,requiredTag:''};
let result=relationshipContext.relationshipCheck(role,hangup,'困了就先睡吧。');
assert.equal(result.ok,false,'a strong hangup event must not be calmly skipped');
assert.ok(result.fails.some(x=>x.includes('拒接或挂断')));
result=relationshipContext.relationshipCheck(role,hangup,'你刚拒了我的电话，先告诉我为什么。');
assert.equal(result.ok,true,'a direct continuation of the real hangup should pass');

const verification={kind:'verification',eventId:'v1',summary:'要求定位',hard:true,requiredTag:'[要求定位|你刚才一直没回复]'};
assert.equal(relationshipContext.relationshipCheck(role,verification,'你在哪里？').ok,false,'verification must keep the exact single action tag');
assert.equal(relationshipContext.relationshipCheck(role,verification,'[要求定位|你刚才一直没回复]').ok,true);

relationshipContext.relationshipCommit(role,hangup,'你刚拒了我的电话，先告诉我为什么。');
assert.equal(role.state.relationshipTurn,1);
assert.equal(role.state.relationshipTurns.length,1);
assert.equal(relationshipContext.relationshipCheck(role,hangup,'你刚拒了我的电话，先告诉我为什么。').ok,false,'an already delivered relationship line must not be sent again');

const daily=functionSource('suspicionCheckDaily');
assert.doesNotMatch(daily,/escContact\(\)===c/,'extreme mode must not disable ordinary daily sensitivity');
assert.match(daily,/c\._esc&&c\._esc\.stage>0/,'a live disappearance chain must still arbitrate competing events');

assert.match(source,/previousSaw/);
assert.match(source,/本次去重铁律/);
assert.match(source,/只针对本次相较上次真正新增或变化的内容反应/);
assert.match(functionSource('remoteControlHistoryPrompt'),/没有新变化的内容不能重新汇报、重新质问或当成第一次发现/);

const wxContext=vm.createContext({
  lastMsg:id=>({time:id==='new'?13000:9000}),
  phoneFriendState:()=>({messages:{},groupMessages:{}}),
  pfMsgList:()=>[],
});
vm.runInContext([
  functionSource('wxLoginSnapshotNorm'),
  functionSource('wxLoginLastSend'),
  functionSource('wxLoginTargetLatest'),
  functionSource('wxLoginRepeatTarget'),
].join(';'),wxContext);
assert.equal(
  wxContext.wxLoginSnapshotNorm('10:30 张三：到了 5分钟前'),
  wxContext.wxLoginSnapshotNorm('11:45 张三：到了 2分钟前'),
  'volatile timestamps must not turn an unchanged snapshot into new content',
);
const loginRole={wxLoginHistory:[{actions:[{type:'send',target:'张三',text:'我知道了',ts:10000}]}]};
assert.equal(wxContext.wxLoginRepeatTarget(loginRole,'role','old','张三'),true,'unchanged targets must not receive another login message');
assert.equal(wxContext.wxLoginRepeatTarget(loginRole,'role','new','张三'),false,'a genuinely newer target message may be handled');

console.log('extreme relationship policy tests passed');
