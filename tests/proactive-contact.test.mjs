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

const maybeSource = functionSource('initiativeMaybeSend');
assert.doesNotMatch(maybeSource, /manualReply/, 'manual reply mode must not suppress proactive contact');
assert.doesNotMatch(maybeSource, /memoryPending/, 'a pending memory confirmation must not suppress proactive contact forever');
assert.doesNotMatch(maybeSource, /humanLikeOn/, 'the dedicated proactive switch must not depend on the general human-likeness switch');
assert.doesNotMatch(maybeSource, /isMain\(/, 'proactive contact must work for the currently active identity too');
assert.doesNotMatch(maybeSource, /15\s*\*\s*60000/, 'the configured interval must not be replaced by a 15-minute floor');
assert.doesNotMatch(maybeSource, /a\.key===['"]sleep['"]/, 'an inferred sleep activity must not override an explicitly configured proactive window');
assert.match(maybeSource, /affNow\(c\)>=35/, 'ignore escalation may suppress ordinary initiative only when escalation is actually eligible');
assert.match(maybeSource, /callEligible=plan\.kind!==['"]location['"]/);
assert.match(source, /setInterval\(checkInitiative,15000\)/);
assert.match(source, /visibilitychange['"],initiativeWakeCheck/);
assert.match(source, /pageshow['"],initiativeWakeCheck/);
assert.match(source, /focus['"],initiativeWakeCheck/);
assert.match(source, /主动消息禁止自动附带照片、自拍或 \[图片\] 标签/);
assert.match(source, /_initiativeNoImage=initiativeBlocksImage\(note\)/);
assert.match(source, /_initiativeNoImage&&[\s\S]*photoTail=3;continue/);

const blockContext = vm.createContext({});
vm.runInContext(functionSource('initiativeBlocksImage') + ';globalThis.block=initiativeBlocksImage;', blockContext);
assert.equal(blockContext.block('[系统：这是一次【主动消息】，不是对方刚发来新话。]'), true);
assert.equal(blockContext.block('给我发一张照片'), false, 'an explicit real chat request must still be allowed to produce a photo');

const delayContext = vm.createContext({S: {settings: {proactiveIdleMin: 1}}});
vm.runInContext(functionSource('initiativeDelayMs') + ';globalThis.delay=initiativeDelayMs();', delayContext);
assert.equal(delayContext.delay, 60000, 'one minute in settings must mean one real minute');

const planContext = vm.createContext({
  S: {settings: {imgGen: true}},
  initiativeMemory: () => null,
  imageGenerationAvailable: () => true,
  roleLiveLoc: () => ({name: '公司', address: '办公区'}),
  activityHash: () => 0,
  memoryNorm: (v) => String(v),
  hm: () => '12:00',
  Math,
});
vm.runInContext(functionSource('initiativePlan') + ';globalThis.plan=initiativePlan;', planContext);
const role = {id: 'r1', traits: {active: 50, cling: 60}};
const activity = {label: '在公司工作', busy: 4};
const ordinaryPlan = planContext.plan(role, activity, {turn: 1, lastKind: '', lastMemory: ''});
assert.notEqual(ordinaryPlan.kind, 'photo');
assert.doesNotMatch(ordinaryPlan.note, /\[图片\|/);
const locationPlan = planContext.plan(role, activity, {turn: 3, lastKind: '', lastMemory: ''});
assert.equal(locationPlan.kind, 'location');
assert.match(locationPlan.note, /\[位置\|公司\|办公区\]/);

function schedulerContext({planKind = 'share', callProb = 0, queue = true, delivered = queue, activityKey = 'work'} = {}) {
  const now = Date.now();
  const state = {nextAt: now - 1, lastAt: 0, lastKind: '', lastMemory: '', turn: 0};
  const c = {id: 'r1', proactive: {enabled: true, start: 0, end: 23, times: 10}, followups: []};
  const calls = {queued: 0, called: 0, saved: 0};
  const sandboxMath = Object.create(Math);
  sandboxMath.random = () => 0;
  const context = vm.createContext({
    S: {
      settings: {manualReply: true, initiative: true, replyDelay: 0, proactiveIdleMin: 1},
      _proactiveCount: {}, couple: null,
      jail: {active: false}, me: {sleep: {active: null}, report: {active: null}},
    },
    _call: null,
    _initiativeBusy: {},
    _replying: null,
    _replyTimers: {},
    _IGT: [30],
    memoryScopeKey: () => 'main',
    replyStateKey: (id) => id,
    initiativeWindow: () => true,
    initiativeState: () => state,
    initiativeDelayMs: () => 60000,
    lastMsg: () => ({role: 'user', time: now - 120000}),
    lastUserTs: () => 0,
    currentRoleActivity: () => ({key: activityKey, label: activityKey === 'sleep' ? '在睡觉或休息' : '正在忙工作', busy: 4, until: now + 21600000}),
    initiativePlan: () => ({kind: planKind, memory: null, note: '[系统：主动联系]'}),
    effCallProb: () => callProb,
    proCall: () => { calls.called++; return true; },
    scheduleReply: (id, note, done) => { calls.queued++; if (done) done(delivered); return queue; },
    memoryNorm: (v) => String(v),
    save: () => { calls.saved++; },
    setTimeout: () => 1,
    Date,
    Math: sandboxMath,
  });
  vm.runInContext(functionSource('initiativeRunKey') + ';' + maybeSource + ';globalThis.run=initiativeMaybeSend;', context);
  return {result: context.run(c), state, c, calls, S: context.S};
}

const message = schedulerContext();
assert.equal(message.result, true);
assert.equal(message.calls.queued, 1, 'manual reply mode and a busy activity must still allow proactive messages');
assert.equal(message.S._proactiveCount.r1.n, 1);

const lateNight = schedulerContext({activityKey: 'sleep'});
assert.equal(lateNight.result, true, 'an explicit active window must still honor the one-minute interval at night');
assert.equal(lateNight.calls.queued, 1);

const failedQueue = schedulerContext({queue: false});
assert.equal(failedQueue.result, false);
assert.equal(failedQueue.S._proactiveCount.r1, undefined, 'a blocked queue must not consume the daily quota');

const failedDelivery = schedulerContext({queue: true, delivered: false});
assert.equal(failedDelivery.result, true);
assert.equal(failedDelivery.S._proactiveCount.r1, undefined, 'an AI failure after queuing must not consume the daily quota');

const call = schedulerContext({callProb: 100});
assert.equal(call.calls.called, 1, 'high call probability must be checked on ordinary proactive opportunities');
assert.equal(call.calls.queued, 0);

const location = schedulerContext({planKind: 'location', callProb: 100});
assert.equal(location.calls.called, 0, 'location sharing must not be replaced by a call');
assert.equal(location.calls.queued, 1);

console.log('proactive contact tests passed');
