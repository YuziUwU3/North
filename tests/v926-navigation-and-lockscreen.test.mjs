import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const glass = fs.readFileSync(new URL('../glass-theme.css', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../小手机.html', import.meta.url), 'utf8');
const localWebView = fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift', import.meta.url), 'utf8');
const nativeApp = fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneCompanionTestApp.swift', import.meta.url), 'utf8');

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
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

test('malformed legacy offline records are normalized before opening a date', () => {
  const ctx = vm.createContext({ S: { offline: { role: { msgs: null, memory: 'bad', history: {}, started: 1 } } } });
  vm.runInContext(`${functionSource('offData')};globalThis.value=offData('role');`, ctx);
  assert.ok(Array.isArray(ctx.value.msgs));
  assert.ok(Array.isArray(ctx.value.memory));
  assert.ok(Array.isArray(ctx.value.history));
  assert.equal(ctx.value.started, true);
  assert.match(source, /type="button" class="it offline-role-entry"/);
});

test('native role navigation only consumes a fresh real notification tap once', async () => {
  const start = source.indexOf('const _nativeRolePushTaps=new Set();');
  const end = source.indexOf('\nfunction togProactive', start);
  assert.ok(start >= 0 && end > start);
  const calls = [];
  const ctx = vm.createContext({
    window: {},
    Date: { now: () => 1_000_000 },
    roleServerPushPull: async () => true,
    getC: id => id === 'role' ? { id } : null,
    openChat: id => calls.push(id),
    openIncoming: () => calls.push('incoming'),
    _call: null,
  });
  vm.runInContext(source.slice(start, end), ctx);
  assert.equal(await ctx.window.__smallPhoneOpenRolePush({ roleId: 'role' }), false);
  assert.deepEqual(calls, []);
  const payload = { roleId: 'role', source: 'notificationTap', nonce: 'one', tappedAt: 1_000_000 };
  assert.equal(await ctx.window.__smallPhoneOpenRolePush(payload), true);
  assert.deepEqual(calls, ['role']);
  assert.equal(await ctx.window.__smallPhoneOpenRolePush(payload), false);
  assert.equal(await ctx.window.__smallPhoneOpenRolePush({ ...payload, nonce: 'old', tappedAt: 700_000 }), false);
  assert.deepEqual(calls, ['role']);
  assert.match(nativeApp, /"source": "notificationTap"/);
  assert.match(nativeApp, /"nonce": UUID\(\)\.uuidString/);
  assert.match(nativeApp, /"tappedAt": String\(Int64\(Date\(\)\.timeIntervalSince1970 \* 1000\)\)/);
  assert.match(localWebView, /abs\(now - tappedAt\) <= 120_000/);
  assert.match(localWebView, /private var openingRolePush = false/);
});

test('glass themes no longer override the v910 screensaver presentation', () => {
  for (const selector of ['lockshade', 'locktop', 'locktime', 'lockdate', 'locknote', 'lockempty', 'lockquick', 'lockpull']) {
    assert.doesNotMatch(glass, new RegExp(`north-glass-ui \\.${selector}`));
  }
  assert.match(source, /<div class="locktop"><div class="locktime">\$\{hm\(\)\}<\/div><div class="lockdate">\$\{lockDateText\(\)\}<\/div><\/div>/);
  assert.match(html, /\.locktop\{position:relative;z-index:2;padding:54px 22px 0;text-align:center/);
  assert.match(html, /\.locktime\{font-family:var\(--north-clock-font\);font-size:96px;font-weight:400/);
});
