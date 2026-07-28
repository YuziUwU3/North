import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

function functionSource(name) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `missing ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false;
  for (let i = brace; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

const noon = Date.now();
const rows = [];
const context = vm.createContext({
  msgs: () => rows,
  S: {me: {name: '小北'}},
  Date,
});
vm.runInContext(
  functionSource('rejectedCallToday') + '\n' + functionSource('rejectedCallPrompt') +
  ';globalThis.stats=rejectedCallToday;globalThis.prompt=rejectedCallPrompt;',
  context,
);

rows.push({role: 'user', type: 'sys', content: '你拒绝了语音通话', time: noon - 60_000});
assert.deepEqual({...context.stats('r1', noon)}, {count: 1, voice: 1, video: 0, lastAt: noon - 60_000});
assert.match(context.prompt('r1', '语音通话', 'initial'), /今天第一次被ta拒接/);

rows.push({role: 'user', type: 'sys', content: '你拒绝了视频通话', time: noon});
const second = context.prompt('r1', '视频通话', 'initial');
assert.match(second, /今天第 2 次被ta拒接/);
assert.match(second, /此前的拒接|前面已经被拒接过 1 次/);
assert.match(second, /不能又像第一次一样只说“怎么不接”/);

rows.push({role: 'user', type: 'sys', content: '你拒绝了语音通话', time: noon - 86_400_000});
assert.equal(context.stats('r1', noon).count, 2, 'yesterday must not leak into today count');

const decline = functionSource('declineCall');
assert.match(decline, /rejectedCallPrompt\(id,kindTxt,'initial'\)/);
assert.match(decline, /maybeCallBack\(id,_kind,false,true\)/);
assert.match(decline, /suspicionHandleUserHangup\(c,\{kind:_kind,dir:'incoming',dur:0,rejected:true\}\)/);
assert.match(functionSource('scheduleRejectedCallFollowup'), /rejectedCallPrompt\(id,kindTxt,'followup',aid,meName\)/);

console.log('call rejection awareness tests passed');
