import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const app = read('app.js');
const migration = read('supabase/migrations/202608010001_friend_accept_reliability.sql');

function functionSource(name) {
  const start = app.indexOf(`async function ${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  let depth = 0, body = false;
  for (let i = app.indexOf('{', start); i < app.length; i++) {
    if (app[i] === '{') { depth++; body = true; }
    else if (app[i] === '}' && body && --depth === 0) return app.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

assert.match(migration, /select r\.from_id, r\.status into v_from, v_status[\s\S]*for update/);
assert.match(migration, /return \(p_accept and v_status = 'accepted'\) or \(not p_accept and v_status = 'rejected'\)/);
assert.match(migration, /where from_id = v_to and to_id = v_from and status = 'pending'/);
assert.match(app, /let _pfSyncBusy=false,_pfLastAuto=0,_pfSendBusy=\{\},_pfRespondBusy=\{\},_pfSyncQueued=null/);
assert.match(app, /if\(changed!==true\)[\s\S]*这条申请已失效或被处理/);
assert.match(app, /await phoneFriendSync\(true,false,true\)/);
assert.match(app, /busy\?'处理中…':'通过'/);

const state = {
  id: 'SPTEST0002',
  secret: 'secret',
  requests: [{ id: 'request-1', direction: 'incoming', status: 'pending', from_id: 'SPTEST0001', from_name: '好友甲', from_avatar: 'A' }],
  friends: [],
  lastSync: 123,
};
let rpcCalls = 0, syncCalls = 0, saveCalls = 0, renderCalls = 0;
const notices = [];
let releaseRpc;
const rpcResult = new Promise((resolve) => { releaseRpc = resolve; });
const context = vm.createContext({
  _pfRespondBusy: {},
  phoneFriendState: () => state,
  phoneFriendById: (id) => state.friends.find((friend) => friend.phone_id === id) || null,
  pfEnsure: async () => true,
  pfRpc: async () => { rpcCalls++; return rpcResult; },
  phoneFriendSync: async () => { syncCalls++; },
  toast: (text) => notices.push(text),
  save: () => { saveCalls++; },
  render: () => { renderCalls++; },
  Date,
});
vm.runInContext(`${functionSource('phoneFriendRespond')};globalThis.respond=phoneFriendRespond;`, context);
const first = context.respond('request-1', true);
const duplicate = context.respond('request-1', true);
assert.equal(rpcCalls, 0, 'the first call is still waiting for profile readiness');
await Promise.resolve();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(rpcCalls, 1);
await duplicate;
releaseRpc(true);
await first;
assert.equal(rpcCalls, 1, 'double taps must not submit twice');
assert.equal(state.requests[0].status, 'accepted');
assert.equal(state.requests[0]._responding, undefined);
assert.deepEqual(state.friends.map((friend) => friend.phone_id), ['SPTEST0001']);
assert.equal(state.lastSync, 0);
assert.equal(syncCalls, 1);
assert.ok(saveCalls > 0 && renderCalls > 0);
assert.deepEqual(notices, ['已通过']);

console.log('phone friend acceptance tests passed');
