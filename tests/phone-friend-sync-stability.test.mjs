import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const app = read('app.js');
const migration = read('supabase/migrations/202607300002_friend_sync_performance.sql');

assert.match(app, /let _pfSyncBusy=false,_pfLastAuto=0,_pfSendBusy=\{\},_pfSyncQueued=null/);
assert.match(app, /function pfQueueSync\(silent,forceProfile,forceFull\)/);
assert.match(app, /if\(_pfSyncBusy\)\{pfQueueSync\(silent,forceProfile,forceFull\);return;\}/);
assert.match(app, /const queued=_pfSyncQueued;_pfSyncQueued=null;if\(queued\)setTimeout\(\(\)=>phoneFriendSync/);

const start = app.indexOf('let _pfSyncBusy=false');
const end = app.indexOf('function pfFriendIds', start);
assert.ok(start >= 0 && end > start);
const sandbox = { setTimeout, globalThis: null };
sandbox.globalThis = sandbox;
vm.runInNewContext(app.slice(start, end) + `
  pfQueueSync(true,false,false);
  pfQueueSync(false,true,false);
  pfQueueSync(true,false,true);
  globalThis.queued = _pfSyncQueued;
`, sandbox);
assert.deepEqual(JSON.parse(JSON.stringify(sandbox.queued)), {
  silent: false,
  forceProfile: true,
  forceFull: true,
});

for (const index of [
  'phone_friend_requests_from_status_updated_idx',
  'phone_friend_requests_to_status_updated_idx',
  'phone_friend_messages_from_created_idx',
  'phone_friend_messages_to_created_idx',
  'phone_friend_group_members_phone_group_idx',
  'phone_friend_group_messages_group_created_idx',
  'phone_friend_message_receipts_received_idx',
  'phone_friend_group_message_receipts_received_idx',
  'phone_friend_message_recalls_recalled_idx',
]) {
  assert.match(migration, new RegExp(`create index if not exists ${index}`));
}

console.log('phone friend sync stability tests passed');
