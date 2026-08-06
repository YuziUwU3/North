import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const app = readFileSync(join(root, 'app.js'), 'utf8');
const migration = readFileSync(join(root, 'supabase', 'migrations', '202608060003_phone_role_scheduled_push.sql'), 'utf8');
const edge = readFileSync(join(root, 'supabase', 'functions', 'phone-role-push', 'index.ts'), 'utf8');

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

test('server scheduler persists profiles and an idempotent outbox', () => {
  assert.match(migration, /create table if not exists public\.phone_role_push_profiles/);
  assert.match(migration, /create table if not exists public\.phone_role_push_outbox/);
  assert.match(migration, /dedupe_key text not null unique/);
  assert.match(migration, /enable row level security/g);
  assert.match(migration, /phone_role_push_upsert_profile/);
  assert.match(migration, /phone_role_push_pull/);
  assert.match(migration, /phone_role_push_ack/);
  assert.match(migration, /phone-role-push-every-minute/);
});

test('edge dispatcher writes the message first and then attempts APNs', () => {
  assert.match(edge, /phone_role_push_claim_due/);
  assert.match(edge, /phone_role_push_outbox/);
  assert.match(edge, /ignoreDuplicates: true/);
  assert.match(edge, /eq\("dedupe_key", dedupe\)/);
  assert.match(edge, /outboxRow\?\.push_status !== "sent"/);
  assert.match(edge, /apns-push-type": "alert"/);
  assert.match(edge, /rolePush: \{ outboxId \}/);
  assert.match(edge, /OPENAI_API_KEY/);
  assert.doesNotMatch(edge, /fallbackMessage/);
  assert.doesNotMatch(edge, /醒了没有|这么晚了还没睡|在忙什么|有空回我一下/);
  assert.match(edge, /kind: "unavailable", body: ""/);
  assert.match(edge, /kind: "silent", body: ""/);
  assert.match(edge, /只输出 \[保持安静\]/);
  assert.match(edge, /recentBodies\.some\(\(old\) => roleTextRepeated\(body, old\)\)/);
  assert.match(edge, /prior\[a\.length\] \/ a\.length >= 0\.84/);
  assert.match(edge, /phone_role_push_outbox[\s\S]{0,300}select\("body"\)/);
});

test('web client opt-in only sends a bounded role summary', () => {
  const profile = functionSource('roleServerPushProfile');
  assert.match(profile, /roleName/);
  assert.match(profile, /persona/);
  assert.match(profile, /slice\(0,1200\)/);
  assert.doesNotMatch(profile, /messages|health|location|screenTime/);
  assert.match(app, /关闭小手机后仍可主动联系/);
  assert.match(functionSource('roleServerPushToggle'), /phone_role_push_upsert_profile|roleServerPushSync/);
});

test('returned role messages are deduplicated and appended to the matching chat', () => {
  const pull = functionSource('roleServerPushPull');
  assert.match(pull, /phone_role_push_pull/);
  assert.match(pull, /getC\(row\.roleId\)/);
  assert.match(pull, /_rolePushId===row\.id/);
  assert.match(pull, /_serverProactive&&now-\(m\.time\|\|0\)<24\*3600000/);
  assert.match(pull, /replyDedupNorm\(m\.content\|\|'\'\)===bodyKey/);
  assert.match(pull, /_serverProactive:true/);
  assert.match(pull, /phone_role_push_ack/);
  assert.match(app, /setInterval\(\(\)=>roleServerPushPull\(false\),60000\)/);
  assert.match(app, /visibilitychange[\s\S]{0,1600}roleServerPushPull\(true\)/);
});

test('deleting a role disables its server schedule', () => {
  assert.match(functionSource('c_delete'), /phone_role_push_disable_profile/);
});
