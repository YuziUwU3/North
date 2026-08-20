import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const app = readFileSync(join(root, 'app.js'), 'utf8');
const edge = readFileSync(join(root, 'supabase/functions/phone-role-push/index.ts'), 'utf8');
const sql = readFileSync(join(root, 'supabase/migrations/202608120002_background_role_tasks.sql'), 'utf8');

test('reply and device work can be handed to the server without racing user activity', () => {
  assert.match(app, /roleBackgroundPrepare\(id,'reply_handoff'/);
  assert.match(app, /roleBackgroundPrepare\(id,'device_handoff'/);
  assert.doesNotMatch(app, /roleServerPushTouchActivity\(id,m\.time,true\);roleBackgroundCancel\(id\);roleBackgroundPrepare/);
  assert.match(sql, /kind = 'app_followup' and status = 'pending'/);
  assert.match(edge, /currentTask\?\.status === "canceled"/);
});

test('role profile no longer exposes the one minute real test', () => {
  assert.doesNotMatch(app, /roleServerPushOneMinuteTest|one_minute_test.*Date\.now\(\)\+60000/s);
  assert.match(edge, /task\.kind === "one_minute_test"/);
  assert.match(sql, /one_minute_test/);
});

test('app awareness is gated, limited, mutually exclusive and cooled down', () => {
  assert.match(app, /appWatchEnabled:!!\(c\.proactive&&c\.proactive\.appWatch\)/);
  assert.match(app, /Math\.max\(0,Math\.min\(5,/);
  assert.match(edge, /Math\.random\(\) < 0\.5/);
  assert.match(edge, /nextDue\(profile, 90\)/);
  assert.match(edge, /due_at: new Date\(Date\.now\(\) \+ 5 \* 60_000\)/);
  assert.match(edge, /String\(payload\.followupChoice \|\| "message"\) === "lock"/);
});

test('background automations require fresh device facts and only record delivered events', () => {
  for (const kind of ['morningSleep', 'eveningScreen', 'absenceBattery', 'criticalBattery', 'emotionCare', 'manualUnlock']) {
    assert.match(edge, new RegExp(kind));
  }
  assert.match(edge, /freshWithin\(telemetry\.generatedAt, 10 \* 60_000\)/);
  assert.match(edge, /freshWithin\(screen\.generatedAt, 20 \* 60_000\)/);
  assert.match(edge, /if \(!automationDelivered\)/);
  assert.match(sql, /attempts smallint not null default 0/);
});

test('foreground and background automations have one owner and respect occupied scenes', () => {
  assert.match(app, /roleBackgroundAvailable==='function'&&roleBackgroundAvailable\(c\.id\)\)return false/);
  assert.match(app, /localRuns:Object\.assign\(\{\},st\.automationRuns\|\|\{\}\)/);
  assert.match(app, /suspended=!!\(roleOnlineProactiveBlocked\(c\.id\)/);
  assert.match(edge, /if \(profileTemporarilySuspended\(profile\)\) return null/);
  assert.doesNotMatch(edge, /if \(config\.suspended === true\) return null/);
  assert.match(edge, /localRuns\.morningSleep/);
  assert.match(edge, /Math\.max\(serverCount, localCount\)/);
});

test('time awareness and cohabitation state are synchronized explicitly', () => {
  assert.match(app, /timeAware:S\.settings\.timeAware!==false/);
  assert.match(app, /if\(!S\.settings\.timeAware\)return'';const sc=/);
  assert.match(app, /timeOn\?initiativeAwayPrompt\(c\):''/);
  assert.match(app, /时间感知已关闭：不得使用或推断日期/);
  assert.match(app, /id="cohab_manual_phase"/);
  assert.match(app, /id="cohab_manual_activity"/);
  assert.match(app, /id="cohab_manual_place"/);
});
