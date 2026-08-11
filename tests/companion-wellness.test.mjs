import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const app = readFileSync(join(root, 'app.js'), 'utf8');
const syncSql = readFileSync(join(root, 'supabase', 'migrations', '202608050001_phone_companion_secure_sync.sql'), 'utf8');

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

test('wellness permissions are privacy scoped and health is off by default', () => {
  const context = vm.createContext({});
  vm.runInContext(`${functionSource('companionDefaultState')}this.value=companionDefaultState();`, context);
  assert.equal(context.value.schema, 8);
  assert.equal(context.value.permissions.battery, true);
  assert.equal(context.value.permissions.health, false);
  assert.equal(context.value.battery, null);
  assert.equal(context.value.health, null);
  assert.deepEqual(JSON.parse(JSON.stringify(context.value.automations)), {
    eveningScreen: true,
    morningSleep: true,
    absenceBattery: false,
    criticalBattery: false,
    emotionCare: false,
    manualUnlockAlert: true,
  });
  assert.deepEqual(JSON.parse(JSON.stringify(context.value.automationWindows)), {
    sleepStart: '07:00',
    sleepEnd: '12:00',
    usageStart: '21:30',
    usageEnd: '23:59',
  });
});

test('battery payload accepts a real zero percent value and clamps invalid ranges', () => {
  const context = vm.createContext({});
  vm.runInContext(`
    ${functionSource('companionTime')}
    ${functionSource('companionNormalizeBattery')}
    this.zero=companionNormalizeBattery({batteryLevel:0,batteryState:'使用电池',lowPowerMode:true,generatedAt:'2026-08-06T00:00:00Z'});
    this.high=companionNormalizeBattery({batteryLevel:145});
  `, context);
  assert.equal(context.zero.level, 0);
  assert.equal(context.zero.lowPower, true);
  assert.equal(context.zero.state, '使用电池');
  assert.equal(context.high.level, 1);
});

test('health payload is bounded and preserves explicit user-recorded mind state', () => {
  const context = vm.createContext({});
  vm.runInContext(`
    ${functionSource('companionTime')}
    ${functionSource('companionNormalizeHealth')}
    this.value=companionNormalizeHealth({
      generatedAt:'2026-08-06T00:00:00Z',steps:999999,activeEnergyKcal:640,
      heartRateBpm:72,hrvMs:44,sleepSeconds:100000,
      stateOfMind:{valence:2,labels:['calm'],userRecorded:true,recordedAt:'2026-08-05T23:00:00Z'}
    });
  `, context);
  assert.equal(context.value.steps, 200000);
  assert.equal(context.value.heartRateBpm, 72);
  assert.equal(context.value.sleepSeconds, 86400);
  assert.equal(context.value.stateOfMind.valence, 1);
  assert.equal(context.value.stateOfMind.userRecorded, true);
});

test('companion UI and role prompt expose wellness only through separate switches', () => {
  assert.match(app, /查看 iPhone 电量/);
  assert.match(app, /查看 Apple Watch \/ 健康摘要/);
  assert.match(app, /cou_companion_wellness/);
  assert.match(app, /if\(per\.battery&&st\.battery\)/);
  assert.match(app, /if\(per\.health&&st\.health\)/);
  assert.match(app, /不得说成自动情绪识别/);
  assert.match(app, /不能诊断疾病/);
});

test('long absence checks both battery and location and must visibly contact the user', () => {
  const permissions = functionSource('companionAutomationPermissions');
  const toggle = functionSource('companionToggleAutomation');
  const candidate = functionSource('companionAutomationCandidate');
  const send = functionSource('companionAutomationMaybeSend');
  assert.match(app, /absenceBattery:\['battery','location'\]/);
  assert.match(permissions, /Array\.isArray\(value\)/);
  assert.match(toggle, /查看 iPhone 电量/);
  assert.match(toggle, /查看最近定位/);
  assert.match(candidate, /a\.absenceBattery&&per\.battery&&per\.location/);
  assert.match(candidate, /companionAutomationFresh\(loc\.ts,30\*60000,now\)/);
  assert.match(candidate, /最近位置/);
  assert.match(candidate, /查完后必须马上采取一种可见行动/);
  assert.match(candidate, /\[来电\|语音\]/);
  assert.match(candidate, /禁止保持安静/);
  assert.match(send, /candidate\.kind==='absenceBattery'&&proCall\(c\.id\)/);
  assert.match(app, /失联时查看 iPhone 电量与位置/);
  assert.match(app, /查完必须发消息或来电/);
});

test('server snapshots accept telemetry and health without changing secure RPC schema', () => {
  assert.match(app, /snapshot\.deviceTelemetry\|\|snapshot\.battery/);
  assert.match(app, /companionNormalizeHealth\(snapshot\.health\)/);
  assert.match(app, /phone_companion_pull_snapshot/);
  assert.match(syncSql, /phone_companion_push_snapshot/);
});
