import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');

function functionSource(name){
  const start=app.indexOf(`function ${name}(`);
  assert.ok(start>=0,`${name} must exist`);
  const open=app.indexOf('{',start);
  let depth=0;
  for(let i=open;i<app.length;i++){
    if(app[i]==='{')depth++;
    else if(app[i]==='}'&&--depth===0)return app.slice(start,i+1);
  }
  throw new Error(`${name} is incomplete`);
}

const foreign={id:'s_chat_model',tagName:'INPUT',blurred:0,blur(){this.blurred++;}};
const context=vm.createContext({document:{activeElement:foreign}});
vm.runInContext(functionSource('callReleaseForeignInput'),context);
assert.equal(context.callReleaseForeignInput(),true);
assert.equal(foreign.blurred,1,'a settings input left focused under the call must be released');

const callInput={id:'callMsg',tagName:'INPUT',blurred:0,blur(){this.blurred++;}};
context.document.activeElement=callInput;
assert.equal(context.callReleaseForeignInput(),false);
assert.equal(callInput.blurred,0,'rerendering the call must not blur its own input');

const renderCall=functionSource('renderCall');
assert.match(renderCall,/if\(_call\.min&&_call\.state!=='incoming'\)[\s\S]*?updateCallSub\(\);return;}\s*callReleaseForeignInput\(\);/,'focus isolation must run only for the full call, after the mini-call return');
assert.match(html,/html\.north-native-app \.phone:has\(\.callscreen\.show:not\(\.mini\) \.callinput\.show\),html\.north-ios-home-safe \.phone:has\(\.callscreen\.show:not\(\.mini\) \.callinput\.show\)\{position:absolute\}/,'the iOS coordinate fix must be limited to native/Apple-compatible full calls with an active input');
assert.doesNotMatch(html,/html\.north-android[^\n{]*callscreen[^\n{]*callinput/,'Android must not receive the iOS call-coordinate workaround');

console.log('call input focus isolation tests passed');
