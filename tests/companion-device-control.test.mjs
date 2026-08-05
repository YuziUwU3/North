import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const app = readFileSync(join(root, 'app.js'), 'utf8');

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

test('couple space exposes a third companion-device page', () => {
  assert.match(app, /id="coutab3"[^>]*onclick="couTab\(3\)"/);
  assert.match(app, /id="coupage3"/);
  assert.match(app, /伴生设备/);
  assert.match(functionSource('couTab'), /\[1,2,3\]/);
});

test('control defaults to both while role reads default to external only', () => {
  const context = vm.createContext({});
  vm.runInContext(`${functionSource('companionDefaultState')}\nthis.value=companionDefaultState();`, context);
  assert.equal(context.value.defaultScope, 'both');
  assert.equal(context.value.readScope, 'external');
  assert.equal(context.value.screenTimeMode, 'total_only');
  assert.equal(context.value.roleAccess, false);
  assert.match(app, /内外同时/);
  assert.match(app, /读取来源铁律/);
  assert.match(app, /绝对不要与小手机内置计时或剧情位置合并/);
});

test('internal and external apps bind through distinct stable ids', () => {
  const context = vm.createContext({});
  vm.runInContext(`${functionSource('companionBindingForInternal')}\n${functionSource('companionExternalById')}\n${functionSource('companionBoundExternal')}`, context);
  const state = {
    apps: [{ id: 'ios.token.douyin', name: '抖音' }],
    bindings: [{ internalAppId: 'douyin', externalAppId: 'ios.token.douyin' }],
  };
  assert.equal(context.companionBindingForInternal(state, 'douyin').externalAppId, 'ios.token.douyin');
  assert.equal(context.companionBoundExternal(state, 'douyin').id, 'ios.token.douyin');
  assert.equal(context.companionBoundExternal(state, 'music'), null);
  assert.match(functionSource('companionDispatchBound'), /binding\.externalAppId/);
  assert.match(functionSource('companionDispatchBound'), /外置 App 尚未通过稳定 ID 完成绑定/);
});

test('a both-scope instruction creates separate internal and external rules', () => {
  const dispatch = functionSource('companionDispatchBound');
  assert.match(dispatch, /needsExternal=scope!==\x27internal\x27/);
  assert.match(dispatch, /needsInternal=scope!==\x27external\x27/);
  assert.match(dispatch, /companionApplyInternalAction/);
  assert.match(dispatch, /companionApplyAction/);
  assert.match(dispatch, /外置 DeviceActivity 规则已提交/);
  assert.match(functionSource('applyControlTags'), /仅内置\|只内置\|仅外置\|只外置\|内外同时/);
  assert.match(functionSource('applyControlTags'), /companionDispatchBound\(\x27limit\x27/);
});

test('internal and external usage stay independent and per-app external time is pending', () => {
  const ui = functionSource('renderCompanionPage');
  assert.match(ui, /internalUsed=internalId\?usedSecOf\(internalId\):0/);
  assert.match(ui, /companionDuration\(app\.usedSec\)/);
  assert.match(ui, /两边各自计时/);
  assert.match(ui, /绝不合并时长/);
  assert.match(ui, /待 iPhone 端接入/);
  assert.match(functionSource('companionRolePrompt'), /当前只有总时长/);
  assert.match(functionSource('companionRolePrompt'), /不得自行拆分或猜测/);
});

test('prototype data is clearly non-device data and version is aligned', () => {
  assert.match(functionSource('companionLoadDemo'), /不会连接或控制真实 iPhone/);
  assert.match(functionSource('companionSourceLabel'), /原型测试数据 · 非真实设备/);
  assert.match(app, /const APP_VER='v798 · 伴生设备控制页原型'/);
});
