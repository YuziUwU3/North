import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const app = readFileSync(join(root, 'app.js'), 'utf8');

function functionSource(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  let depth = 0;
  let opened = false;
  for (let i = start; i < app.length; i += 1) {
    if (app[i] === '{') { depth += 1; opened = true; }
    if (app[i] === '}') {
      depth -= 1;
      if (opened && depth === 0) return app.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated ${name}`);
}

function candidateContext(messages = []) {
  const context = vm.createContext({
    S: { me: { name: '用户' } },
    msgs: () => messages,
    msgToText: (m) => m.content || '',
    lastMsg: () => messages.at(-1) || null,
    fmtDT: (value) => String(value),
    initiativeQueueNote: (_c, _plan, note) => note,
  });
  vm.runInContext(`
    ${functionSource('companionDuration')}
    ${functionSource('companionAutomationDay')}
    ${functionSource('companionAutomationFresh')}
    ${functionSource('companionAutomationRecentUser')}
    ${functionSource('companionAutomationNote')}
    ${functionSource('companionBatteryIsCharging')}
    ${functionSource('companionAutomationCandidate')}
  `, context);
  return context;
}

function baseState(now) {
  return {
    permissions: { screenTime: true, battery: true, health: true },
    automations: { eveningScreen: false, morningSleep: false, absenceBattery: false, criticalBattery: false, emotionCare: false, manualUnlockAlert: false },
    automationRuns: {},
    lastSync: now,
    screenTimeAvailable: true,
    screenTimeMode: 'per_app',
    screenTimeSec: 7200,
    apps: [{ name: 'QQ', usedSec: 1800 }, { name: '音乐', usedSec: 600 }],
    battery: { level: 0.42, state: '使用电池', lowPower: false, ts: now },
    health: { ts: now, sleepSeconds: 8 * 3600, heartRateBpm: 76, heartRateAt: now },
  };
}

test('all companion proactive checks are opt-in and shown in one permission panel', () => {
  assert.match(app, /eveningScreen:false,morningSleep:false,absenceBattery:false,criticalBattery:false,emotionCare:false,manualUnlockAlert:false/);
  assert.match(app, /id="cou_companion_automations"/);
  assert.match(app, /晚间查看今日屏幕与逐 App/);
  assert.match(app, /醒来查看昨晚睡眠/);
  assert.match(app, /失联时查看 iPhone 电量/);
  assert.match(app, /电量 5% 及以下提醒充电/);
  assert.match(app, /难过时参考最新心率/);
  assert.match(app, /手动解锁立即告诉角色/);
});

test('critical battery reminder is fresh, persona-led and once per discharge episode', () => {
  const now = new Date(2026, 7, 6, 18, 0, 0).getTime();
  const context = candidateContext([{ role: 'assistant', type: 'text', content: '好', time: now - 60000, id: 'a1' }]);
  const st = baseState(now);
  st.automations.criticalBattery = true;
  st.battery = { level: 0.05, state: '使用电池', lowPower: true, ts: now };
  context.st = st; context.now = now; context.c = { id: 'role' };
  vm.runInContext('this.pick=companionAutomationCandidate(c,st,now)', context);
  assert.equal(context.pick.kind, 'criticalBattery');
  assert.match(context.pick.note, /按你自己的关系和人设立刻提醒ta充电/);

  st.automationRuns.criticalBatteryLow = true;
  vm.runInContext('this.repeat=companionAutomationCandidate(c,st,now)', context);
  assert.equal(context.repeat, null);

  st.automationRuns.criticalBatteryLow = false;
  st.battery.state = '充电中';
  vm.runInContext('this.charging=companionAutomationCandidate(c,st,now)', context);
  assert.equal(context.charging, null);
  assert.match(app, /battery\.level>=\.1\|\|companionBatteryIsCharging\(st\.battery\)/);
  assert.match(app, /candidate\.kind==='criticalBattery'/);
});

test('daily morning and evening checks require real fresh snapshots', () => {
  const morning = new Date(2026, 7, 6, 8, 0, 0).getTime();
  const mc = candidateContext([{ role: 'user', type: 'text', content: '早', time: morning - 3600000, id: 'u1' }]);
  const ms = baseState(morning);
  ms.automations.morningSleep = true;
  mc.st = ms; mc.now = morning; mc.c = { id: 'role' };
  vm.runInContext('this.pick=companionAutomationCandidate(c,st,now)', mc);
  assert.equal(mc.pick.kind, 'morningSleep');

  const evening = new Date(2026, 7, 6, 22, 0, 0).getTime();
  const ec = candidateContext([{ role: 'user', type: 'text', content: '我去忙了', time: evening - 3600000, id: 'u2' }]);
  const es = baseState(evening);
  es.automations.eveningScreen = true;
  ec.st = es; ec.now = evening; ec.c = { id: 'role' };
  vm.runInContext('this.pick=companionAutomationCandidate(c,st,now)', ec);
  assert.equal(ec.pick.kind, 'eveningScreen');
  assert.match(ec.pick.note, /QQ 30分钟/);
});

test('emotion care never treats heart rate as proof of lying or crying', () => {
  const now = new Date(2026, 7, 6, 18, 0, 0).getTime();
  const context = candidateContext([{ role: 'user', type: 'text', content: '我有点难过，想哭', time: now - 25 * 60000, id: 'sad-1' }]);
  const st = baseState(now);
  st.automations.emotionCare = true;
  context.st = st; context.now = now; context.c = { id: 'role' };
  vm.runInContext('this.pick=companionAutomationCandidate(c,st,now)', context);
  assert.equal(context.pick.kind, 'emotionCare');
  assert.match(context.pick.note, /心率不能证明ta撒谎、哭泣/);
  assert.match(app, /心率升高或降低不能证明撒谎、哭泣、背叛或任何具体情绪/);
});

test('absence battery check is rate limited and cannot invent a shutdown', () => {
  assert.match(app, /now-last>=6\*3600000&&count<2/);
  assert.match(app, /只有电量为0且状态明确时才能怀疑关机/);
  assert.match(app, /runs\.absenceBatteryCount=\(\+runs\.absenceBatteryCount\|\|0\)\+1/);
});

test('manual unlock alert ignores recent panel commands and records a single delivery', () => {
  assert.match(app, /old\.locked\|\|app\.locked/);
  assert.match(app, /x\.action==='unlock'.*2\*60000/);
  assert.match(app, /kind:'manualUnlock'/);
  assert.match(app, /这可能是.*手动解开，也可能是系统状态变化，不能直接断言/);
  assert.match(app, /event\.delivered=true/);
});

test('companion automation reuses the existing initiative queue and its wake checks', () => {
  assert.match(app, /function checkInitiative\(\).*companionAutomationMaybeSend\(\)/);
  assert.match(app, /scheduleReply\(c\.id,candidate\.note/);
  assert.match(app, /initiativeQueueNote\(c,\{kind:'companion-'/);
  assert.match(app, /document\.visibilityState==='hidden'/);
});
