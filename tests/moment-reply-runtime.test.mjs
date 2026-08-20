import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

function functionSource(name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers.map(marker => source.indexOf(marker)).filter(index => index >= 0).sort((a, b) => a - b)[0];
  assert.notEqual(start, undefined, `missing ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

function runtime(result) {
  const role = { id: 'role-1', name: '先生', remark: '先生' };
  const target = { id: 'comment-1', cid: 'me', name: 'North', text: '你真的会回我吗？', time: 1 };
  const post = { id: 'moment-1', authorId: 'role-1', text: '今天有点想你。', comments: [target] };
  let requests = 0, saves = 0;
  const context = vm.createContext({
    Set, Date, String, Object, Array, Promise,
    S: { me: { name: 'North' }, moments: [post] },
    _momentReplyBusy: new Set(),
    getC: id => id === role.id ? role : null,
    msgs: () => [{ role: 'user', text: '朋友圈记得回我' }],
    msgToText: msg => msg.text || '',
    cleanMomentText: text => String(text || ''),
    selectRelevantMemory: () => ({ items: [{ text: '用户重视真实回复' }] }),
    buildSystem: () => 'system',
    wechatNaturalOn: () => true,
    memoryRetrievalPrompt: () => '\nselected-memory',
    chatAPI: async messages => { requests += 1; context.lastRequest = messages; if (result instanceof Error) throw result; return result; },
    cleanReply: text => String(text || '').trim(),
    roleVisibleEnvelopeText: text => String(text || ''),
    save: () => { saves += 1; },
    momentRenderKeepScroll: () => {},
    uid: () => 'reply-1',
    cur: () => ({ p: 'roleMomentDetail' }),
    wxTab: 'moments',
  });
  vm.runInContext(functionSource('momentReplySpecific'), context);
  vm.runInContext(functionSource('reactToComment'), context);
  return { context, post, target, role, stats: () => ({ requests, saves }) };
}

test('a real Moment model result is appended to the exact comment thread once', async () => {
  const run = runtime('当然会，刚才就在等你来问。');
  await run.context.reactToComment(run.post, run.role.id, run.target);
  assert.equal(run.stats().requests, 1);
  assert.equal(run.post.comments.length, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(run.post.comments[1])), {
    id: 'reply-1', name: '先生', cid: 'role-1', text: '当然会，刚才就在等你来问。',
    time: run.post.comments[1].time, replyToId: 'comment-1', replyToName: 'North',
  });
  assert.equal(run.target._roleReplyStatus, undefined);
  assert.match(run.context.lastRequest[1].content, /刚刚在评论区对你说/);
});

test('a failed Moment model call records failure and never fabricates a role comment', async () => {
  const run = runtime(new Error('upstream timeout'));
  await run.context.reactToComment(run.post, run.role.id, run.target);
  assert.equal(run.stats().requests, 1);
  assert.equal(run.post.comments.length, 1);
  assert.equal(run.target._roleReplyStatus, 'failed');
  assert.match(run.target._roleReplyError, /upstream timeout/);
});
