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

function detector(messages) {
  const norm = text => String(text || '').toLowerCase().replace(/\[[^\]]*\]/g, '').replace(/[\s，。！？、,.!?~～：:；;“”"'（）()【】]/g, '');
  const context = vm.createContext({
    messages,
    actId: () => 'main',
    msgsForAccount: () => messages,
    msgToText: m => m && m.content || '',
    initiativeVisibleText: text => String(text || '').split(/\n+/).filter(x => x.trim() && !/^\s*[\[【]/.test(x)).join(' '),
    replyDedupNorm: norm,
    replyBigramScore(a, b) {
      a = norm(a); b = norm(b);
      if (!a || !b) return 0;
      if (a === b) return 1;
      const grams = s => { const out = new Set(); for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2)); return out; };
      const x = grams(a), y = grams(b); let hit = 0;
      x.forEach(v => { if (y.has(v)) hit++; });
      return 2 * hit / (x.size + y.size);
    },
    replyLcsContainment(a, b) {
      a = norm(a).slice(0, 240); b = norm(b).slice(0, 240);
      if (!a || !b) return 0;
      let short = a, long = b;
      if (short.length > long.length) [short, long] = [long, short];
      let prev = new Uint16Array(short.length + 1), next = new Uint16Array(short.length + 1);
      for (let i = 0; i < long.length; i++) {
        for (let j = 0; j < short.length; j++) next[j + 1] = long[i] === short[j] ? prev[j] + 1 : Math.max(prev[j + 1], next[j]);
        [prev, next] = [next, prev]; next.fill(0);
      }
      return prev[short.length] / short.length;
    }
  });
  for (const name of ['ordinaryReplyPreviousGroup', 'ordinaryReplyRepeatInfo', 'ordinaryReplyRepeatPrompt']) {
    vm.runInContext(functionSource(name), context);
  }
  return context;
}

test('an immediately repeated visible reply group is detected even when the user repeats the same short message', () => {
  const previous = ['北。', '说这两个字之前先想清楚。', '你今天不喝水，不吃饭，喝西梅汁把自己喝坏了，现在跟我说分手？', '你是不舒服还是在闹？'];
  const messages = [
    { role: 'user', type: 'text', content: '分手' },
    ...previous.map(content => ({ role: 'assistant', type: 'text', content })),
    { role: 'user', type: 'text', content: '分手' }
  ];
  const context = detector(messages);
  const info = context.ordinaryReplyRepeatInfo('role', 'main', '[心情|她又说分手了]\n' + previous.join('\n'));
  assert.ok(info);
  assert.equal(info.repeatedUser, true);
  assert.match(context.ordinaryReplyRepeatPrompt(info, {}, '分手'), /又说了一次/);
  assert.match(context.ordinaryReplyRepeatPrompt(info, {}, '分手'), /把对话往前推进/);
});

test('short catchphrases and genuinely different follow-ups are not blocked', () => {
  const messages = [
    { role: 'user', type: 'text', content: '在吗' },
    { role: 'assistant', type: 'text', content: '北。' },
    { role: 'user', type: 'text', content: '在吗' }
  ];
  const context = detector(messages);
  assert.equal(context.ordinaryReplyRepeatInfo('role', 'main', '北。'), null);

  messages.splice(1, 1, { role: 'assistant', type: 'text', content: '先告诉我你现在到底怎么想，我们把这件事讲清楚。' });
  assert.equal(context.ordinaryReplyRepeatInfo('role', 'main', '我知道你又说了一次。这次我不替你猜，你直接告诉我，是认真的，还是想让我听见你现在有多难受？'), null);
});

test('ordinary chat uses one narrow rewrite without turning repetition into no reply', () => {
  const ai = functionSource('aiReply');
  assert.doesNotMatch(ai, /请优先回应下面这些【最新未回复消息】/);
  assert.doesNotMatch(ai, /replyPendingUserText\(id\)[^]{0,120}hist\.push/);
  assert.match(ai, /const _ordinaryRepeat=ordinaryReplyRepeatInfo/);
  assert.equal((ai.match(/ordinaryReplyRepeatPrompt\(/g) || []).length, 1);
  assert.match(ai, /if\(fix[^]*!ordinaryReplyRepeatInfo\(id,replyAccount,fix\)\)content=fix/);
  assert.doesNotMatch(ai, /_ordinaryRepeat[^]{0,800}return false/);
  assert.match(functionSource('ordinaryReplyRepeatInfo'), /min<18/);
  assert.match(functionSource('ordinaryReplyRepeatInfo'), /lcs>=\.93/);
  assert.match(functionSource('ordinaryReplyRepeatInfo'), /bigram>=\.94/);
});
