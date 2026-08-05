import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const app = readFileSync(join(root, 'app.js'), 'utf8');
const sql = readFileSync(
  join(root, 'supabase', 'migrations', '202608050001_phone_companion_secure_sync.sql'),
  'utf8',
);
const retentionSql = readFileSync(
  join(root, 'supabase', 'migrations', '202608050002_phone_companion_three_day_audit.sql'),
  'utf8',
);

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

test('sync tables are not exposed through permissive RLS policies', () => {
  assert.match(sql, /revoke all on table public\.phone_companion_links from anon, authenticated/i);
  assert.match(sql, /revoke all on table public\.phone_companion_commands from anon, authenticated/i);
  assert.doesNotMatch(sql, /create policy[\s\S]+using \(true\)/i);
});

test('pairing expires and separates owner from device authentication', () => {
  assert.match(sql, /phone_companion_owner_ok\(p_target, p_owner_secret\)/i);
  assert.match(sql, /phone_companion_device_ok\(p_target, p_device_secret\)/i);
  assert.match(sql, /pair_expires_at >= now\(\)/i);
  assert.match(sql, /phone_companion_hash\(v_target \|\| ':' \|\| trim/i);
  assert.match(sql, /interval '10 minutes'/i);
});

test('real snapshot mapping reads external payload only', () => {
  const source = functionSource('companionApplyServerPayload');
  assert.match(source, /data\.snapshot/);
  assert.match(source, /screen\.totalSeconds/);
  assert.match(source, /companionSnapshotApps\(st,screen\)/);
  assert.match(source, /snapshot\.location/);
  assert.match(source, /snapshot\.footprints/);
  assert.match(source, /if\(!st\.linked\)\{[\s\S]*st\.apps=\[\][\s\S]*st\.location=null/);
  assert.doesNotMatch(source, /usedSecOf\(/);
  assert.doesNotMatch(source, /S\.me\.appUsage/);
});

test('pairing and commands use dedicated companion RPCs', () => {
  assert.match(functionSource('companionBeginPairing'), /phone_companion_begin_pairing/);
  assert.match(functionSource('companionPollSnapshot'), /phone_companion_pull_snapshot/);
  assert.match(functionSource('companionSendCommand'), /phone_companion_enqueue_command/);
  assert.match(functionSource('companionBindExternal'), /externalAppId/);
  assert.match(functionSource('renderCompanionPage'), /绑定小手机同名 App（可选）/);
  assert.match(functionSource('renderCompanionPage'), /不绑定也能单独锁定、解锁和限额真实 iPhone/);
  assert.doesNotMatch(functionSource('companionPollSnapshot'), /phone_external_events/);
});

test('a bound external action is enqueued only once', () => {
  const apply = functionSource('companionApplyAction');
  const dispatch = functionSource('companionDispatchBound');
  assert.match(apply, /!st\.demo&&!opt\.skipLog\)companionSendCommand/);
  assert.equal((dispatch.match(/companionSendCommand\(/g) || []).length, 1);
});

test('server companion command history is reduced to three days', () => {
  assert.match(retentionSql, /created_at < now\(\) - interval '3 days'/i);
  assert.doesNotMatch(retentionSql, /30 days/i);
});
