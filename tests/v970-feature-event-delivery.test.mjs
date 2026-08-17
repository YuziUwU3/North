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

test('real feature events are distinct from optional proactive checks', () => {
  const context = vm.createContext({ featureEventNoteActive: note => /功能事件即时反应/.test(String(note || '')) });
  vm.runInContext(functionSource('featureEventAutoActive') + ';this.detect=featureEventAutoActive', context);
  assert.equal(context.detect('[系统：你刚发现用户改了微信备注。]'), true);
  assert.equal(context.detect('[真实事件：用户关闭了后台权限。]'), true);
  assert.equal(context.detect('[系统：用户拒绝了你的放映邀请。]'), true);
  assert.equal(context.detect('[主动联系自主决策｜现在是允许主动联系的时间窗口]'), false);
  assert.equal(context.detect('[真实健康事实：现在23点，看到今天步数。]'), false);
  assert.equal(context.detect('[系统：之前用户说要出门，现在时间应该到了。]'), false);
});

test('feature events survive ordinary reply cancellation and get one light no-output retry', () => {
  const scheduler = functionSource('scheduleReply');
  assert.match(functionSource('replyTouch'), /clearTimeout\(_replyTimers\[k\]\)/);
  assert.doesNotMatch(functionSource('replyTouch'), /_replyFeaturePending\[k\]/);
  assert.match(scheduler, /featureEventQueueMerge\(id,note,aid\)/);
  assert.match(scheduler, /queuedFeature\.length\?Math\.min\(220/);
  assert.match(scheduler, /本次仅重试一次/);
  assert.match(scheduler, /featureEventQueueAck\(id,aid,note,success\)/);
  assert.match(functionSource('offlineReplyIntent'), /featureEventNoteActive\(note\).*return'user'/);
  assert.match(functionSource('aiReply'), /featureEventNoteActive\(note\)\?'user'/);
});

test('diary, phone password, remark and permission changes use reliable feature delivery', () => {
  assert.match(functionSource('spyDiaryBusted'), /scheduleFeatureReply/);
  assert.match(functionSource('spyDiaryBusted'), /日记密码首次输错/);
  assert.match(functionSource('spyBusted'), /scheduleFeatureReply/);
  assert.match(functionSource('spyPin'), /_spyWrong\[id\]>=3/);
  assert.match(functionSource('hisRemarkDiscoveryNote'), /featureEventNote\('微信备注被修改'/);
  assert.match(functionSource('companionTogglePermission'), /companionPermissionReaction/);
  assert.match(functionSource('companionToggleAutomation'), /companionPermissionReaction/);
  assert.match(functionSource('companionToggleRoleAccess'), /companionPermissionReaction/);
});

test('call direction, rejection, missed calls and hangups remain real events', () => {
  assert.match(functionSource('callMissed'), /scheduleFeatureReply/);
  assert.match(functionSource('declineCall'), /scheduleFeatureReply/);
  assert.match(functionSource('hangupCall'), /scheduleFeatureReply/);
  assert.match(functionSource('wechatCallEventReplyNote'), /wechatNaturalCallEventNote\(legacy\)/);
  const callAI = functionSource('callAI');
  assert.match(callAI, /!_connectionEvent&&!_inspectionCompletion/);
  assert.match(callAI, /当前唯一事件：电话刚刚接通/);
  assert.match(callAI, /这通电话是你主动打给/);
  assert.match(callAI, /主动打给你，你只是接听/);
});

test('screen-share state change keeps call context, translation and natural-reaction guard', () => {
  assert.match(functionSource('callScreenShareEventContext'), /本通电话最近真实上下文/);
  assert.match(functionSource('callScreenShareRoleEvent'), /不能把“屏幕共享已开始／已结束”直接复述或翻译成通知播报/);
  assert.match(functionSource('callScreenShareRoleEvent'), /每句外语台词后仍必须紧跟一行普通话中文翻译/);
  assert.match(functionSource('callScreenShareEventIssue'), /共享状态回复像系统通知/);
});
