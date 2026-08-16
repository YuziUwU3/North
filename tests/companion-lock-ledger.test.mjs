import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const app = readFileSync(join(root, 'app.js'), 'utf8');
const swift = readFileSync(join(
  root,
  'native',
  'private-small-phone',
  'XcodeProject',
  'PhoneCompanionTest',
  'CompanionSyncView.swift',
), 'utf8');
const monitor = readFileSync(join(
  root,
  'native',
  'private-small-phone',
  'XcodeProject',
  'PhoneCompanionMonitor',
  'DeviceActivityMonitorExtension.swift',
), 'utf8');

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

test('schema 7 migrates an existing reported lock into a persistent lock intent', () => {
  const context = vm.createContext({ Date });
  vm.runInContext(`
    ${functionSource('companionLockIntentsNormalize')}
    this.normalize=companionLockIntentsNormalize;
  `, context);
  const intents = context.normalize({}, [{ id: 'ios.douyin', locked: true }], 6, 1234);
  assert.equal(intents['ios.douyin'].desiredLocked, true);
  assert.equal(intents['ios.douyin'].source, 'schema6-migration');
});

test('an unlocked snapshot cannot clear a desired lock or manufacture manual unlock authority', () => {
  const payload = functionSource('companionApplyServerPayloadV7');
  assert.match(payload, /companionDesiredLocked/);
  assert.doesNotMatch(payload, /kind:'manualUnlock'/);
  assert.doesNotMatch(payload, /manual-unlock\|/);
});

test('only explicit lock and unlock actions update the lock intent', () => {
  const action = functionSource('companionApplyActionV7');
  assert.match(action, /companionSetLockIntent\(st,app,true/);
  assert.match(action, /companionSetLockIntent\(st,app,false/);
  assert.match(functionSource('companionApplyServerPayloadV7'), /reportedLocked/);
});

test('daily-limit monitoring rebuild preserves shields and the persistent lock ledger', () => {
  const start = swift.indexOf('private func rebuildDailyLimitMonitoring(');
  const end = swift.indexOf('\n    private var sharedDefaults', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const rebuild = swift.slice(start, end);
  assert.doesNotMatch(rebuild, /dailyLimitStore\.shield\.applications\s*=\s*nil/);
  assert.doesNotMatch(rebuild, /removeObject\(forKey:\s*lockedLimitTokensKey\)/);
  assert.match(swift, /persistentLockLedgerKey/);
  assert.match(swift, /effectiveLockedTokens\(\)/);
  assert.match(swift, /loadLimitLockedTokens\(\)/);
  assert.match(swift, /savePersistentLockLedger/);
});

test('daily-limit shields are retained only for the local usage day', () => {
  assert.match(swift, /lockedLimitDayKey = "limit\.lockedUsageDay"/);
  assert.match(swift, /savedDay != today[\s\S]{0,120}clearDailyLimitLockState\(\)/);
  assert.match(swift, /defaults\.set\([\s\S]{0,100}forKey: lockedLimitDayKey/);
  assert.match(swift, /let savedLimitTokens = loadLimitLockedTokens\(\)[\s\S]{0,120}\.union\(savedLimitTokens\)/);

  assert.match(monitor, /lockedLimitDayKey = "limit\.lockedUsageDay"/);
  assert.match(monitor, /intervalDidStart[\s\S]{0,160}clearDailyLimitLock\(\)/);
  assert.match(monitor, /intervalDidEnd[\s\S]{0,160}clearDailyLimitLock\(\)/);
  assert.match(monitor, /savedDay != today[\s\S]{0,180}removeObject\(forKey: lockedLimitDayKey\)/);
  assert.match(monitor, /defaults\.set\(today, forKey: lockedLimitDayKey\)/);
});

test('native explicit unlock clears manual, daily-limit and ledger stores with rollback state', () => {
  const start = swift.indexOf('case "unlock":');
  const end = swift.indexOf('\n        case "limit":', start);
  const unlock = swift.slice(start, end);
  assert.match(unlock, /previousManualTokens/);
  assert.match(unlock, /previousLimitTokens/);
  assert.match(unlock, /previousLedgerTokens/);
  assert.match(unlock, /dailyLimitStore\.shield\.applications/);
  assert.match(unlock, /persistentLockStore\.shield\.applications/);
  assert.match(unlock, /saveLimitLockedTokens/);
  assert.match(unlock, /savePersistentLockLedger/);
});

test('native and web snapshots carry a local usage day and monotonic usage revision', () => {
  assert.match(swift, /"usageDay"/);
  assert.match(swift, /"timeZone"/);
  assert.match(swift, /"usageRevision"/);
  assert.match(functionSource('companionApplyServerPayloadV7'), /companionUsagePayloadDecision/);
  assert.match(functionSource('companionApplyServerPayloadV7'), /usageRejected/);
});

test('usage policy rejects prior-day and stale payloads but accepts a newer current-day revision', () => {
  const context = vm.createContext({ Date, Intl });
  vm.runInContext(`
    function companionTime(value) {
      const parsed = Date.parse(value || '');
      return Number.isFinite(parsed) ? parsed : 0;
    }
    ${functionSource('companionUsageDayAt')}
    ${functionSource('companionUsagePayloadDecision')}
    this.dayAt=companionUsageDayAt;
    this.decide=companionUsagePayloadDecision;
  `, context);
  const zone = 'Asia/Shanghai';
  const today = context.dayAt(Date.now(), zone);
  const yesterday = context.dayAt(Date.now() - 36 * 60 * 60 * 1000, zone);
  const state = {
    usageDay: today,
    usageRevision: 10,
    usageGeneratedAt: 10,
  };
  assert.equal(context.decide(state, {
    reportAvailable: true,
    usageDay: yesterday,
    timeZone: zone,
    usageRevision: 99,
  }).reason, 'not-current-day');
  assert.equal(context.decide(state, {
    reportAvailable: true,
    usageDay: today,
    timeZone: zone,
    usageRevision: 9,
  }).reason, 'stale-revision');
  assert.equal(context.decide(state, {
    reportAvailable: true,
    usageDay: today,
    timeZone: zone,
    usageRevision: 11,
  }).accept, true);
});

test('a 90-minute limit with more than 100 minutes used cannot clear the lock intent', () => {
  const context = vm.createContext({ Date });
  vm.runInContext(`
    ${functionSource('companionLockIntentsNormalize')}
    this.normalize=companionLockIntentsNormalize;
  `, context);
  const existing = {
    'ios.douyin': {
      desiredLocked: true,
      source: 'role-command',
      updatedAt: 100,
    },
  };
  const intents = context.normalize(existing, [{
    id: 'ios.douyin',
    locked: false,
    limitMin: 90,
    usedSec: 101 * 60,
  }], 7, 200);
  assert.equal(intents['ios.douyin'].desiredLocked, true);
  assert.equal(intents['ios.douyin'].source, 'role-command');
});
