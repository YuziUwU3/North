import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

function functionSource(name) {
  const asyncStart = source.indexOf(`async function ${name}(`);
  const start = asyncStart >= 0 ? asyncStart : source.indexOf(`function ${name}(`);
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

test('offline reply errors distinguish balance, auth, throttling, timeout and empty output', () => {
  const context = vm.createContext({ apiCaughtCN: e => `fallback:${e.message}` });
  vm.runInContext(`${functionSource('offlineReplyFailureReason')}${functionSource('offlineReplyEmptyReason')}this.reason=offlineReplyFailureReason;this.empty=offlineReplyEmptyReason;`, context);
  assert.match(context.reason(new Error('AI点数不足，请充值')), /余额或点数不足/);
  assert.match(context.reason(new Error('HTTP 401 unauthorized')), /API Key 无效/);
  assert.match(context.reason(new Error('HTTP 429 rate limit')), /请求太频繁|额度达到上限/);
  assert.match(context.reason(new Error('request timeout')), /请求超时/);
  assert.match(context.reason(new Error('Failed to connect')), /网络连接失败/);
  assert.match(context.empty(), /接口已经响应/);
  assert.match(context.empty(), /返回可能为空、只含控制标签、重复旧话，或线下格式不完整/);
  assert.match(context.empty(), /不是已确认的余额问题/);
});

test('offline reply UI reports the real reason while preserving the conversation', () => {
  const off = functionSource('offAI');
  assert.match(off, /线下回复未生成：.*offlineReplyEmptyReason/);
  assert.match(off, /线下回复失败：.*offlineReplyFailureReason\(e\)/);
  assert.match(off, /原对话没有被改动/);
  assert.doesNotMatch(off, /线下回复暂时没有生成，原对话没有被改动/);
});
