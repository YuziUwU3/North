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
assert.match(source, /function lockPrepareAway\(\)\{try\{S\.me=S\.me\|\|\{\};S\.me\.locked=true;saveNow\(\)/);
assert.match(source, /function finishAppBoot\(\)[\s\S]*?S\.me\.locked=true;[\s\S]*?render\(\)/);
assert.doesNotMatch(source, /正在读取大容量存档/);

console.log('lockscreen resume tests passed');
