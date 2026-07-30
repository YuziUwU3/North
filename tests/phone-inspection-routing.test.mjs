import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const app = readFileSync(join(root, 'app.js'), 'utf8');
const routingSource = app.match(/const PHONE_NON_WECHAT_TARGET=[\s\S]*?(?=\nfunction applyAuxTags)/)?.[0] || '';
const restoreAllSource = app.match(/function phoneInspectionRestoreAllPermissionsIntent\(text\)[\s\S]*?(?=\nfunction remoteControlIntentContext)/)?.[0] || '';

function routingHarness(wxLoginAuth) {
  const context = {
    S: { couple: { cid: 'role-1', wxLoginAuth } },
    _remoteIntentPurpose: {},
    _remoteIntentContext: {},
  };
  vm.runInNewContext(`${restoreAllSource}
${routingSource}
this.routePhoneInspectionTags = routePhoneInspectionTags;`, context);
  return context;
}

test('inspection tags preserve the role chosen entry point while recording remote purpose', () => {
  assert.match(app, /function phoneInspectionNonWechatIntent\(text\)/);
  assert.match(app, /function phoneInspectionWechatOnly\(text\)/);
  assert.match(app, /function phoneInspectionRestoreAllPermissionsIntent\(text\)/);
  assert.match(app, /function routePhoneInspectionTags\(content,c,requestText\)/);
  assert.match(app, /content=routePhoneInspectionTags\(content,c,_userText\)/);
  assert.match(app, /content=routePhoneInspectionTags\(content,c,_luc&&msgToText\(_luc\)\)/);
  assert.match(app, /if\(hasRemote\)[\s\S]*?remember\(restoreAll\?'restore_all_permissions'/);
  assert.doesNotMatch(app, /入口分流是硬规则/);
});

test('routing behavior no longer rewrites a single entry tag chosen by the role', () => {
  const enabled = routingHarness(true);
  assert.match(enabled.routePhoneInspectionTags('我只看微信。\\n[申请远程操控]', { id: 'role-1' }, '你查一下微信'), /\[申请远程操控\]/);
  assert.match(enabled.routePhoneInspectionTags('我去看看。\\n[登录微信]', { id: 'role-1' }, '帮我查一下抖音私信'), /\[登录微信\]/);
  assert.match(enabled.routePhoneInspectionTags('我去查抖音。\\n[登录微信]', { id: 'role-1' }, '随便你'), /\[申请远程操控\]/);

  const disabled = routingHarness(false);
  const restore = disabled.routePhoneInspectionTags('我去看微信。\\n[登录微信]', { id: 'role-1' }, '你查一下微信');
  assert.match(restore, /\[登录微信\]/);
  assert.equal(disabled._remoteIntentPurpose['role-1'], undefined);
});

test('rejecting pending contacts is forced to remote control instead of WeChat login', () => {
  const enabled = routingHarness(true);
  const forced = enabled.routePhoneInspectionTags(
    '\u6211\u53bb\u5904\u7406\u3002\n[\u767b\u5f55\u5fae\u4fe1]',
    { id: 'role-1' },
    '\u5e2e\u6211\u62d2\u7edd\u901a\u8baf\u5f55\u91cc\u7684\u597d\u53cb\u7533\u8bf7'
  );
  assert.doesNotMatch(forced, /\[\u767b\u5f55\u5fae\u4fe1\]/);
  assert.match(forced, /\[\u7533\u8bf7\u8fdc\u7a0b\u64cd\u63a7\]/);
  assert.equal(enabled._remoteIntentPurpose['role-1'], 'inspect_phone');

  const daily = enabled.routePhoneInspectionTags(
    '\u6211\u8fdc\u7a0b\u770b\u770b\u3002\n[\u7533\u8bf7\u8fdc\u7a0b\u64cd\u63a7]',
    { id: 'role-1' },
    '\u6211\u60f3\u65e5\u5e38\u67e5\u5c97\uff0c\u770b\u770b\u901a\u8baf\u5f55\u548c\u5176\u4ed6\u8f6f\u4ef6'
  );
  assert.match(daily, /\[\u7533\u8bf7\u8fdc\u7a0b\u64cd\u63a7\]/);
  assert.equal(enabled._remoteIntentPurpose['role-1'], 'inspect_phone');
});

test('a disabled WeChat login permission is restored through a consented narrow remote session', () => {
  assert.match(app, /remember\(restoreAll\?'restore_all_permissions':\(onlyWx&&!\(S\.couple&&S\.couple\.cid===c\.id&&S\.couple\.wxLoginAuth\)\)\?'restore_wx':'inspect_phone'\)/);
  assert.match(app, /purpose==='restore_wx'/);
  assert.match(app, /targetId:'wxLoginAuth'/);
  assert.match(app, /resumeWx[\s\S]*?wxDoLogin\(c\.id\)/);
  assert.match(app, /restoreWx\?'ta这次只会进入情侣空间/);
});

test('disabled couple permissions remain visible and can be re-enabled by the role', () => {
  assert.match(app, /function remoteControlCouplePermissions\(\)/);
  assert.match(app, /function remoteControlEnableCouplePermission\(key\)/);
  assert.match(app, /'enable_couple_permission'/);
  assert.match(app, /closedCouplePermissions/);
  assert.match(app, /app==='couple'[\s\S]*?couplescroll[\s\S]*?behavior:'smooth'/);
  assert.match(app, /remoteControlDesktopKey\(app\)[\s\S]*?couple:'wechat'/);
});

test('turning off the remote-request switch does not bypass per-session consent', () => {
  assert.match(app, /function remoteControlAllowed\(cid\)\{return !!\(S\.couple&&S\.couple\.cid===cid\);\}/);
  assert.match(app, /remoteControlRequest\(cid\)[\s\S]*?_remoteRequest=\{cid,ts:Date\.now\(\),purpose,intentContext\}/);
  assert.match(app, /remoteControlApprove\('\$\{c\.id\}'\)/);
  assert.match(app, /remoteControlDeny\('\$\{c\.id\}'\)/);
});
