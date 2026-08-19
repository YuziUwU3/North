import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

function functionSource(name) {
  const marker = 'function ' + name + '(';
  const start = app.indexOf(marker);
  assert.notEqual(start, -1, name + ' should exist');
  const brace = app.indexOf('{', start);
  let depth = 0, quote = '', escaped = false;
  for (let i = brace; i < app.length; i++) {
    const ch = app[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return app.slice(start, i + 1);
  }
  throw new Error('unterminated ' + name);
}

function bigram(a, b) {
  const norm = s => String(s || '').replace(/\s+/g, '').replace(/[^\u4e00-\u9fa5a-z0-9]/gi, '');
  a = norm(a); b = norm(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const grams = s => { const out = new Set(); for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2)); return out; };
  const x = grams(a), y = grams(b); let hit = 0;
  x.forEach(v => { if (y.has(v)) hit++; });
  return 2 * hit / (x.size + y.size);
}

test('role Moments detect only close recent repetition', () => {
  const c = { id: 'role-1' };
  const context = vm.createContext({
    S: { moments: [{ authorId: c.id, text: '下雨了，路边的桂花香得很，忽然很想去接你下班。' }] },
    replyBigramScore: bigram,
    roleTweetTopics(text) {
      const s = String(text || '');
      return [/想你|想见/.test(s) ? 'miss' : '', /下雨|天气/.test(s) ? 'weather' : '', /吃饭|晚饭/.test(s) ? 'food' : ''].filter(Boolean);
    }
  });
  vm.runInContext(functionSource('roleMomentNorm'), context);
  vm.runInContext(functionSource('roleMomentSimilarity'), context);
  assert.equal(context.roleMomentSimilarity(c, '下雨了，路边的桂花香得很，忽然很想去接你下班。').hard, true);
  assert.equal(context.roleMomentSimilarity(c, '下雨了，路边桂花还是很香，忽然很想去接你下班。').soft, true);
  const different = context.roleMomentSimilarity(c, '晚饭第一次把糖醋汁调对了，给某人留了一小碗。');
  assert.equal(different.hard, false);
  assert.equal(different.soft, false);
  assert.equal(different.score, 0);
});

test('every role Moment entry point uses generation and duplicate-safe publishing', () => {
  assert.match(functionSource('doAutoMoment'), /publishRoleSocialAutonomous\(c,'moment'/);
  assert.match(functionSource('refreshMoments'), /publishRoleSocialAutonomous\(c,'moment'/);
  assert.match(functionSource('publishRoleSocialAutonomous'), /roleMomentGenerate/);
  assert.match(functionSource('publishRoleSocialAutonomous'), /publishRoleMoment/);
  assert.match(functionSource('postRoleMoment'), /^function postRoleMoment\([^]*return publishRoleMoment/);
  assert.match(functionSource('roleMomentGenerate'), /for\(let attempt=0;attempt<2;attempt\+\+\)/);
  assert.match(functionSource('publishRoleMoment'), /roleMomentSimilarity\(c,tx\)\.hard/);
  const ai = functionSource('aiReply');
  assert.equal((ai.match(/roleMomentRepeatPrompt\(/g) || []).length, 1);
  assert.doesNotMatch(ai, /_momentRepeat[^]{0,900}return false/);
});

test('remote-control completion carries actual successful actions into a feature event', () => {
  const context = vm.createContext({ S: { me: { name: '小北' } } });
  vm.runInContext(functionSource('remoteControlCompletionDetail'), context);
  const detail = context.remoteControlCompletionDetail({
    cancelled: true,
    actions: [
      { memory: '查看了小北小手机里的「微信聊天」，实际看到：今晚早点回家' },
      { memory: '删除了小北的微信联系人「甲」' },
      { ok: false, memory: '失败动作绝不能出现' }
    ]
  }, '你提前结束了本次授权');
  assert.match(detail, /亲手提前结束/);
  assert.match(detail, /查看了小北小手机/);
  assert.match(detail, /删除了小北的微信联系人/);
  assert.doesNotMatch(detail, /失败动作绝不能出现/);
  assert.match(detail, /必须知道并记住/);

  const finish = functionSource('remoteControlFinish');
  assert.match(finish, /scheduleFeatureReply\(c\.id,featureEventNote\('远程操控结束',detail\)/);
  assert.doesNotMatch(finish, /不要复盘、汇报、列举或暗示/);
  assert.doesNotMatch(finish, /delayedAccountReply/);
});
