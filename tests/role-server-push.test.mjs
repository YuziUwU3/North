import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const app = readFileSync(join(root, 'app.js'), 'utf8');
const migration = readFileSync(join(root, 'supabase', 'migrations', '202608060003_phone_role_scheduled_push.sql'), 'utf8');
const avatarMigration = readFileSync(join(root, 'supabase', 'migrations', '202608070001_phone_role_avatar_notifications.sql'), 'utf8');
const contextMigration = readFileSync(join(root, 'supabase', 'migrations', '202608080001_phone_role_push_context_reset.sql'), 'utf8');
const naturalMigration = readFileSync(join(root, 'supabase', 'migrations', '202608090001_phone_role_push_natural_messages.sql'), 'utf8');
const edge = readFileSync(join(root, 'supabase', 'functions', 'phone-role-push', 'index.ts'), 'utf8');
const notificationService = readFileSync(join(root, 'docs', 'ios', 'v831角色头像通信通知', 'NotificationService.swift'), 'utf8');

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

function edgeFunctionSource(name) {
  const start = edge.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing edge ${name}`);
  let depth = 0;
  let opened = false;
  for (let i = start; i < edge.length; i += 1) {
    if (edge[i] === '{') { depth += 1; opened = true; }
    if (edge[i] === '}') {
      depth -= 1;
      if (opened && depth === 0) return edge.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated edge ${name}`);
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
  assert.match(edge, /rolePush: \{ outboxId/);
  assert.match(edge, /OPENAI_API_KEY/);
  assert.match(edge, /DASHSCOPE_API_KEY/);
  assert.match(edge, /https:\/\/dashscope\.aliyuncs\.com\/compatible-mode\/v1/);
  assert.match(edge, /ROLE_PUSH_DASHSCOPE_MODEL/);
  assert.match(edge, /qwen-plus/);
  assert.match(edge, /for \(const provider of providers\)/);
  assert.match(edge, /role-message-provider-failed/);
  assert.doesNotMatch(edge, /fallbackMessage/);
  assert.doesNotMatch(edge, /醒了没有|这么晚了还没睡|在忙什么|有空回我一下|手放哪儿了|手还放那儿/);
  assert.match(edge, /kind: "unavailable", body: ""/);
  assert.match(edge, /kind: "silent", body: ""/);
  assert.match(edge, /只输出 \[保持安静\]/);
  assert.match(edge, /repeatCandidates\.some\(\(old\) => roleMessageRepeated\(body, old\)\)/);
  assert.match(edge, /const min = Math\.min\(a\.length, b\.length\)/);
  assert.match(edge, /if \(length < 8\) return \(length - 1\) \/ length/);
  assert.match(edge, /if \(length < 12\) return 0\.72/);
  assert.match(edge, /for \(let attempt = 0; attempt < 2; attempt \+= 1\)/);
  assert.match(edge, /与近期已经发过的话过于相似/);
  assert.match(edge, /不要只改几个字重复原意/);
  assert.match(edge, /sawGeneratedCandidate \? \{ kind: "silent"/);
  assert.match(edge, /phone_role_push_outbox[\s\S]{0,300}select\("body"\)/);
  assert.match(edge, /profile\.recent_context/);
  assert.match(edge, /profile\.memory_context/);
  assert.match(edge, /最近的真实聊天/);
  assert.match(edge, /长期记忆、对话总结与世界设定/);
  assert.match(edge, /真实恋人的日常聊天/);
  assert.match(edge, /严禁使用破折号或横杠字符/);
  assert.match(edge, /roleMessageStyleInvalid\(body, messageMax\)/);
  assert.match(edge, /select\("enabled,next_due_at,last_user_at,recent_context,memory_context"\)/);
  assert.match(edge, /!freshProfile\.last_user_at/);
  assert.match(edge, /!latestProfile\.last_user_at/);
  assert.match(edge, /Date\.parse\(String\(latestProfile\.next_due_at/);
  assert.match(edge, /roleUserFactUnsupported\(body/);
  assert.match(edge, /roleMessageParts\(text\.slice\(0, 1200\), messageMax\)/);
  assert.match(edge, /roleNotificationPreview\(body\)/);
});

test('short proactive messages reject one-word rewrites without blocking different topics', () => {
  const keySource = edgeFunctionSource('roleTextKey').replace('value: unknown', 'value');
  const thresholdSource = edgeFunctionSource('roleRepeatThreshold').replace('length: number', 'length');
  const repeatedSource = edgeFunctionSource('roleTextRepeated')
    .replace('current: string', 'current')
    .replace('previous: string', 'previous');
  const repeated = Function(`${keySource}\n${thresholdSource}\n${repeatedSource}\nreturn roleTextRepeated;`)();
  assert.equal(repeated('North，手还放那儿？', 'North，手放哪儿了？'), true);
  assert.equal(repeated('嗯，去吧宝宝。', '嗯，去吧宝宝。'), true);
  assert.equal(repeated('嗯，去吧宝贝。', '嗯，去吧宝宝。'), true);
  assert.equal(repeated('North，今晚想吃什么？', 'North，外面下雨了。'), false);
  assert.equal(repeated('刚下班，路上买了束花。', '嗯，去吧宝宝。'), false);
});

test('server proactive contact compares ordinary role replies and starts a new event', () => {
  const recentSource = edgeFunctionSource('roleRecentAssistantMessages');
  const recent = Function(`${recentSource}\nreturn roleRecentAssistantMessages;`)();
  const profile = {
    role_name: '小北',
    recent_context: '2026/8/9 21:20:00 North：我先去洗澡\n2026/8/9 21:20:08 小北：嗯，去吧宝宝。',
  };
  assert.deepEqual(recent(profile), ['嗯，去吧宝宝。']);
  assert.match(edge, /repeatCandidates\.some\(\(old\) => roleMessageRepeated\(body, old\)\)/);
  assert.match(edge, /这是一次与上一轮分开的主动联系新事件/);
  assert.match(edge, /不是等待你继续回答的当前回合/);
});

test('role notification avatars use bounded thumbnails and unguessable fetch URLs', () => {
  assert.match(avatarMigration, /avatar_data text not null default ''/);
  assert.match(avatarMigration, /avatar_token uuid not null default gen_random_uuid\(\)/);
  assert.match(avatarMigration, /length\(v_avatar\) > 50000/);
  assert.match(functionSource('rolePushAvatarData'), /canvas\.width=96/);
  assert.match(functionSource('rolePushAvatarData'), /toDataURL\('image\/jpeg',\.78\)/);
  assert.match(functionSource('roleServerPushSync'), /profile\.avatarData=await rolePushAvatarData\(c\)/);
  assert.match(edge, /eq\("avatar_token", token\)/);
  assert.match(edge, /Date\.now\(\) - 7 \* 86400_000/);
  assert.match(edge, /"mutable-content": 1/);
  assert.match(edge, /avatarURL: roleAvatarURL/);
});

test('iOS notification service upgrades role pushes to communication notifications', () => {
  assert.match(notificationService, /final class NotificationService: UNNotificationServiceExtension/);
  assert.match(notificationService, /INImage\(imageData:/);
  assert.match(notificationService, /INPerson\(/);
  assert.match(notificationService, /INSendMessageIntent\(/);
  assert.match(notificationService, /interaction\.direction = \.incoming/);
  assert.match(notificationService, /content\.updating\(from: intent\)/);
  assert.match(notificationService, /avatarURL\.scheme == "https"/);
  assert.match(notificationService, /data\?\.count \?\? 0\) <= 64_000/);
});

test('web client opt-in sends bounded memory and recent context', () => {
  const profile = functionSource('roleServerPushProfile');
  assert.match(profile, /roleName/);
  assert.match(profile, /persona/);
  assert.match(profile, /slice\(0,1200\)/);
  assert.match(profile, /recentContext:roleServerPushRecentContext\(c\)/);
  assert.match(profile, /memoryContext:roleServerPushMemoryContext\(c\)/);
  assert.match(profile, /lastUserAt:roleServerPushLastUserAt\(c\)/);
  assert.match(profile, /messageMin:min,messageMax:max/);
  assert.match(functionSource('roleServerPushRecentContext'), /slice\(-8000\)/);
  assert.match(functionSource('roleServerPushMemoryContext'), /slice\(0,16000\)/);
  assert.match(functionSource('roleServerPushMemoryContext'), /memoryList\(c,scope\)/);
  assert.match(functionSource('roleServerPushMemoryContext'), /summaryList\(c,scope\)/);
  assert.match(functionSource('roleServerPushMemoryContext'), /aiMemoryDocs\(c\)/);
  assert.match(functionSource('roleServerPushMemoryContext'), /S\.worldbook/);
  assert.match(functionSource('roleServerPushMemoryContext'), /lifeNotes\(\)/);
  assert.match(app, /关闭小手机后仍可主动联系/);
  assert.match(app, /会同步该角色的长期记忆、对话总结和最近聊天上下文/);
  assert.match(functionSource('roleServerPushToggle'), /phone_role_push_upsert_profile|roleServerPushSync/);
  assert.match(functionSource('roleServerPushSyncEnabled'), /21600000/);
});

test('every visible user message resets the server idle timer with synced context', () => {
  assert.match(contextMigration, /recent_context text not null default ''/);
  assert.match(contextMigration, /memory_context text not null default ''/);
  assert.match(contextMigration, /last_user_at timestamptz/);
  assert.match(contextMigration, /phone_role_push_touch_activity/);
  assert.match(contextMigration, /next_due_at = case when enabled then v_activity \+ make_interval\(mins => idle_minutes\)/);
  assert.match(contextMigration, /claimed_until = null/);
  assert.match(contextMigration, /grant execute on function public\.phone_role_push_touch_activity/);
  const touch = functionSource('roleServerPushTouchActivity');
  assert.match(touch, /p_recent_context:roleServerPushRecentContext\(c\)/);
  assert.match(touch, /p_memory_context:roleServerPushMemoryContext\(c\)/);
  assert.match(touch, /p_activity_ms:\+activityAt\|\|Date\.now\(\)/);
  const push = functionSource('pushMsg');
  assert.match(push, /msgs\(id\)\.push\(m\);save\(\);if\(m\.role==='user'&&m\.type!=='sys'\)roleServerPushTouchActivity\(id,m\.time,true\)/);
});

test('returned role messages are deduplicated and appended to the matching chat', () => {
  const pull = functionSource('roleServerPushPull');
  assert.match(pull, /phone_role_push_pull/);
  assert.match(pull, /getC\(row\.roleId\)/);
  assert.match(pull, /_rolePushId===row\.id/);
  assert.match(pull, /initiativeRecentlyRepeated\(c\.id,body,24\*3600000\)/);
  assert.match(pull, /roleServerPushParts\(c,body\)/);
  assert.match(pull, /msg\._serverProactive=true/);
  assert.match(pull, /phone_role_push_ack/);
  assert.match(app, /setInterval\(\(\)=>roleServerPushPull\(false\),60000\)/);
  assert.match(app, /visibilitychange[\s\S]{0,1600}roleServerPushPull\(true\)/);
});

test('server push respects the configured 1-10 message range', () => {
  assert.match(naturalMigration, /message_min smallint not null default 1/);
  assert.match(naturalMigration, /message_max smallint not null default 4/);
});

test('deleting a role disables its server schedule', () => {
  assert.match(functionSource('c_delete'), /phone_role_push_disable_profile/);
});
