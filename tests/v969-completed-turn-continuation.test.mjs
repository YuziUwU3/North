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

test('completed WeChat and call turns are labelled as background, not pending questions', () => {
  const messages = [
    { role: 'user', type: 'text', content: '微信旧问题' },
    { role: 'assistant', type: 'text', content: '微信已经回答' },
    { role: 'user', type: 'text', content: '通话旧问题', _call: true, _cs: 's1' },
    { role: 'assistant', type: 'text', content: '通话已经回答', _call: true, _cs: 's1' },
    { role: 'assistant', type: 'text', content: '翻译重复', _call: true, _cs: 's1', _callTranslationOf: 'x' },
  ];
  const context = vm.createContext({
    msgs: () => messages,
    msgToText: m => m.content,
    _call: { session: 's1' },
  });
  vm.runInContext(functionSource('completedTurnContinuation') + ';this.describe=completedTurnContinuation', context);
  const wechat = context.describe({ id: 'r1' }, 'wechat');
  const call = context.describe({ id: 'r1' }, 'call');
  assert.match(wechat, /微信旧问题/);
  assert.match(wechat, /微信已经回答/);
  assert.doesNotMatch(wechat, /通话旧问题/);
  assert.match(call, /通话旧问题/);
  assert.match(call, /通话已经回答/);
  assert.doesNotMatch(call, /翻译重复/);
  assert.match(call, /禁止再次回答、解释、确认、复述或改写/);
});

test('proactive WeChat and silent call use a new synthetic user turn', () => {
  assert.match(functionSource('initiativeQueueNote'), /completedTurnContinuation\(c,'wechat'\)/);
  assert.match(functionSource('checkCallSilence'), /completedTurnContinuation\(c,'call'\)/);
  assert.match(functionSource('checkCallSilence'), /\{silentContinuation:true\}/);
  assert.match(functionSource('callAI'), /_screenShareEvent\|\|_silentContinuation\|\|_connectionEvent\?'user':'system'/);
  assert.match(functionSource('callAI'), /当前唯一事件：通话静默后的主动续聊/);
  assert.match(functionSource('aiReply'), /friendAcceptedAutoNote\(note\)\|\|initiativeNoteActive\(note\)\|\|wechatNaturalCallEventActive\(note\)\|\|featureEventNoteActive\(note\)\?'user'/);
});

test('call connection and hangup preserve both direction and actor', () => {
  const answer = functionSource('answerCall');
  const hangup = functionSource('hangupCall');
  const callAI = functionSource('callAI');
  assert.match(answer, /这通电话是你主动打给/);
  assert.match(answer, /主动打给你的，你刚接通/);
  assert.match(answer, /\{connectionEvent:true\}/);
  assert.match(callAI, /_screenShareEvent\|\|_silentContinuation\|\|_connectionEvent\?'user':'system'/);
  assert.match(callAI, /当前唯一事件：电话刚刚接通/);
  assert.match(hangup, /callEndedReactionContext\(c,id,_sess,_dir,byAI\?'role':'user'/);
  assert.match(hangup, /wechatNaturalCallEventNote\(eventContext\)/);
  assert.match(functionSource('wechatNaturalCallEventNote'), /电话里已经回应过的用户话语都属于完成的旧轮次/);
});

test('an unanswered role-initiated call creates a distinct natural reaction event', () => {
  const missed = functionSource('callMissed');
  assert.match(missed, /角色本人主动拨给/);
  assert.match(missed, /在响铃时间内没有接听，所以电话从未接通/);
  assert.match(missed, /不能说成.*接通后挂断/);
  assert.match(missed, /wechatNaturalCallEventNote\(missedContext\)/);
  assert.match(missed, /scheduleFeatureReply/);
});

test('hangup context distinguishes user and role actions and carries call content', () => {
  const messages = [
    { role: 'user', type: 'text', content: '刚才聊旅行', _call: true, _cs: 's2' },
    { role: 'assistant', type: 'text', content: '那就去海边', _call: true, _cs: 's2' },
  ];
  const context = vm.createContext({
    msgs: () => messages,
    msgToText: m => m.content,
    S: { me: { name: '小北' } },
  });
  vm.runInContext(functionSource('callEndedReactionContext') + ';this.describeEnd=callEndedReactionContext', context);
  const userEnded = context.describeEnd({ name: '先生' }, 'r1', 's2', 'outgoing', 'user', '语音通话', 65);
  const roleEnded = context.describeEnd({ name: '先生' }, 'r1', 's2', 'incoming', 'role', '视频通话', 8);
  const incomingUserEnded = context.describeEnd({ name: '先生' }, 'r1', 's2', 'incoming', 'user', '语音通话', 22);
  assert.match(userEnded, /小北主动拨给角色本人/);
  assert.match(userEnded, /最后是小北主动挂断，不是角色本人挂断/);
  assert.match(userEnded, /刚才聊旅行/);
  assert.match(userEnded, /那就去海边/);
  assert.match(roleEnded, /角色本人主动拨给小北/);
  assert.match(roleEnded, /最后是角色本人主动挂断，不是小北挂断/);
  assert.match(incomingUserEnded, /角色本人主动拨给小北/);
  assert.match(incomingUserEnded, /最后是小北主动挂断，不是角色本人挂断/);
});
