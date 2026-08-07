import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const start = source.indexOf('function normalizeLoadedState()');
const end = source.indexOf('\nnormalizeLoadedState();', start);

assert.ok(start >= 0 && end > start, 'normalizeLoadedState should exist');
const functionSource = source.slice(start, end);

function namedFunction(name){
  const at=source.indexOf(`function ${name}`);
  assert.ok(at>=0,`missing ${name}`);
  const brace=source.indexOf('{',at);
  let depth=0;
  for(let i=brace;i<source.length;i++){
    if(source[i]==='{')depth++;
    else if(source[i]==='}'&&--depth===0)return source.slice(at,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

function normalize(me) {
  const context = vm.createContext({
    S: {
      me: { ...me },
      contacts: [],
      settings: {
        initiativeSchedulerV2: 1,
        initiativeSchedulerV3: 1,
        imgModelV3: 1,
      },
    },
  });
  vm.runInContext(`${functionSource}; normalizeLoadedState(); normalizeLoadedState();`, context);
  return context.S.me;
}

assert.equal(normalize({ locked: false }).locked, false, 'normalization must preserve an explicit unlocked value until boot');
assert.equal(normalize({ locked: true }).locked, true, 'an explicitly locked phone must stay locked');
assert.equal(normalize({}).locked, true, 'legacy saved data without a lock flag must open on the screensaver');

assert.match(source, /function lockOpen\(\)\{S\.me\.locked=false;save\(\)/);
assert.match(source, /function lockShow\(drop\)[\s\S]*?S\.me\.locked=true;save\(\)/);
const lockContext=vm.createContext({S:{me:{locked:false}},_savePending:false,_lockAwayAt:0,now:1000,saved:0,painted:0,Date:{now(){return lockContext.now;}},save(){lockContext.saved++;},saveNow(){lockContext.saved++;},renderLockScreen(){lockContext.painted++;},renderLockPull(){}});
vm.runInContext(`${namedFunction('lockPrepareAway')};${namedFunction('lockResumeFromAway')}`,lockContext);
lockContext.lockPrepareAway();
assert.equal(lockContext.S.me.locked,false,'a transient hidden event must not immediately relock the phone');
lockContext.now=3200;
assert.equal(lockContext.lockResumeFromAway(),false,'a short interruption must stay unlocked');
lockContext.lockPrepareAway();
lockContext.now=6000;
assert.equal(lockContext.lockResumeFromAway(),false,'normal background return must stay unlocked even after a longer stay');
assert.equal(lockContext.S.me.locked,false,'backgrounding the already-open app must not show the screensaver again');
lockContext.lockPrepareAway(true);
assert.equal(lockContext.S.me.locked,true,'beforeunload must persist the lock immediately');
assert.match(source, /beforeunload[\s\S]*?lockPrepareAway\(true\)/);
assert.match(source, /visibilitychange[\s\S]*?if\(document\.hidden\)[\s\S]*?lockPrepareAway\(\)/);
assert.match(source, /function finishAppBoot\(\)[\s\S]*?S\.me\.locked=true;[\s\S]*?render\(\)/);
assert.doesNotMatch(source, /正在读取大容量存档/);

console.log('lockscreen resume tests passed');
