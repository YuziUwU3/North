import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const privateSource = fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js', import.meta.url), 'utf8');

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

const eventInfo = Function(`return (${functionSource('foodReceiptEventInfo')})`)();
const replyMatches = Function(`return (${functionSource('foodReceiptReplyMatches')})`)();
const fallback = Function(`return (${functionSource('foodReceiptReplyFallback')})`)();

const event = eventInfo('[系统：小北刚刚签收了你点的外卖「燕麦牛奶粥」。]');
assert.deepEqual(event, { name: '燕麦牛奶粥' });
assert.equal(replyMatches(event, '你刚才对我什么态度，再说一遍？150分钟已经是我心软了。'), false, 'an old lock-topic reply must not satisfy the receipt event');
assert.equal(replyMatches(event, '燕麦牛奶粥到了就趁热吃，别放凉了。'), true, 'a direct food-arrival acknowledgement should pass');
assert.equal(replyMatches(event, '外卖收到了就先吃饭，别饿着。'), true, 'a natural acknowledgement without repeating the exact dish should pass');
assert.match(fallback(event), /燕麦牛奶粥/);
assert.match(fallback(event), /趁热吃/);

const receive = functionSource('foodReceive');
assert.match(receive, /这是本轮新发生且必须先回应的事件/);
assert.match(receive, /优先于此前未完话题/);

const aiReply = functionSource('aiReply');
assert.match(aiReply, /_foodReceiptInfo=replyAccount==='main'\?foodReceiptEventInfo\(note\):null/);
assert.match(aiReply, /if\(_foodReceiptInfo&&!foodReceiptReplyMatches\(_foodReceiptInfo,content\)\)/);
assert.match(aiReply, /foodReceiptReplyFallback\(_foodReceiptInfo\)/);
assert.match(privateSource, /function foodReceiptReplyMatches\(/, 'the private bundle must contain the receipt guard');
assert.match(privateSource, /foodReceiptReplyFallback\(_foodReceiptInfo\)/, 'the private bundle must contain the receipt fallback');

console.log('food receipt priority tests passed');
