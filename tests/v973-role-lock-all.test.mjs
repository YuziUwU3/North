import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const bundled = fs.readFileSync(path.join(root, 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js'), 'utf8');

function functionSource(name, source = app) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`${name} is not closed`);
}

test('ordinary online chat keeps the real iPhone control protocol and exact all-app action', () => {
  const context = vm.createContext({});
  vm.runInContext(`
    function companionReady(st){return !!(st && st.linked);}
    ${functionSource('companionRoleControlOnlyPrompt')}
    this.prompt=companionRoleControlOnlyPrompt;
  `, context);
  const prompt = context.prompt({ name: '角色' }, {
    linked: true,
    permissions: { appControl: true, limits: true },
    apps: [{ name: '微信' }, { name: '抖音' }],
  });
  assert.match(prompt, /当前按稳定 ID 可控制的 App：微信、抖音/);
  assert.match(prompt, /\[锁定\|全部已选 App\|仅外置\]/);
  assert.match(prompt, /立即写入操作记录/);
  assert.match(prompt, /设备回执和新快照确认前绝不能谎称已经锁好/);
  assert.match(app, /if\(!rolePhoneInspectionLaneActive\(\)\)return companionRoleControlOnlyPrompt\(c,config\)/);
});

test('a definite natural claim to lock every app is recovered without depending on a model parser', () => {
  const sent = [];
  const context = vm.createContext({ sent });
  vm.runInContext(`
    const state={linked:true,roleAccess:true,permissions:{appControl:true},apps:[{id:'a'},{id:'b'}]};
    function companionState(){return state;}
    function companionReady(st){return !!st.linked;}
    function companionDispatchRoleByText(action,text,opt){sent.push({action,text,scope:opt.scope,actor:opt.actor});return true;}
    ${functionSource('companionNaturalAllControlAction')}
    ${functionSource('companionRecoverNaturalAllControl')}
    this.detect=companionNaturalAllControlAction;
    this.recover=companionRecoverNaturalAllControl;
  `, context);
  assert.equal(context.detect('我已经把你的所有软件都锁上了。'), 'lock');
  assert.equal(context.detect('全部 App 都给你解开了。'), 'unlock');
  assert.equal(context.detect('再不听话我就把所有软件锁了。'), '');
  assert.equal(context.detect('要不要把全部软件锁掉？'), '');
  assert.equal(context.recover('我把你的软件全部锁掉了。', { name: '北', remark: '先生' }), true);
  assert.deepEqual(JSON.parse(JSON.stringify(sent)), [{ action: 'lock', text: '全部已选 App', scope: 'external', actor: '先生' }]);
});

test('control extraction uses deterministic all-app recovery first and retries parser failures once', () => {
  const extract = functionSource('extractControl');
  assert.ok(extract.indexOf('companionRecoverNaturalAllControl(reply,c)') < extract.indexOf('chatAPI('));
  assert.match(extract, /attempt<2/);
  assert.match(extract, /aux:attempt===0/);
  assert.equal(functionSource('companionRoleControlOnlyPrompt', bundled), functionSource('companionRoleControlOnlyPrompt'));
  assert.equal(functionSource('companionNaturalAllControlAction', bundled), functionSource('companionNaturalAllControlAction'));
  assert.equal(functionSource('extractControl', bundled), extract);
});

test('companion controls resolve a stable app id even after polling reorders the array', () => {
  const context = vm.createContext({});
  vm.runInContext(`${functionSource('companionAppByRef')}this.find=companionAppByRef;`, context);
  const st = { apps: [{ id: 'second', name: 'B' }, { id: 'first', name: 'A' }] };
  assert.equal(context.find(st, 'first').name, 'A');
  assert.equal(context.find(st, 0).name, 'B');
  const render = functionSource('renderCompanionPage');
  assert.match(render, /data-companion-app-id="\$\{esc\(app\.id\)\}"/);
  assert.match(render, /companionBindExternal\(this\.dataset\.companionAppId,this\.value\)/);
  assert.doesNotMatch(render, /companionBindExternal\(\$\{index\}/);
});

test('a refreshed native id repairs the saved association without duplicating the old app', () => {
  const context = vm.createContext({});
  vm.runInContext(`
    ${functionSource('companionRememberBindingTarget')}
    ${functionSource('companionRepairBindings')}
    this.repair=companionRepairBindings;
  `, context);
  const st = {
    apps: [{ id: 'new-token', bindingCode: '013', name: '外置 013' }],
    bindings: [{ id: 'binding.1', internalAppId: 'wechat', externalAppId: 'old-token', externalBindingCode: '013', externalAppName: '微信' }],
    lockIntents: { 'old-token': { desiredLocked: true, source: 'explicit', updatedAt: 1 } },
  };
  const rebound = context.repair(st, [{ id: 'old-token', bindingCode: '013', name: '微信' }]);
  assert.equal(st.bindings[0].externalAppId, 'new-token');
  assert.equal(st.bindings[0].externalAppName, '微信');
  assert.equal(st.apps[0].name, '微信');
  assert.equal(st.lockIntents['new-token'].desiredLocked, true);
  assert.equal(st.lockIntents['old-token'], undefined);
  assert.equal(rebound.has('old-token'), true);
});

test('association metadata is durably saved and bundled code stays synchronized', () => {
  const bind = functionSource('companionBindExternal');
  assert.match(bind, /companionRememberBindingTarget\(binding,app\)/);
  assert.match(bind, /await saveNowAsync\(\)/);
  assert.match(bind, /关联没有保存成功/);
  assert.match(bind, /st\.bindings=oldBindings;app\.name=oldName/);
  assert.ok(bind.indexOf('await saveNowAsync()') < bind.indexOf("companionDispatchBound('limit'"));
  for (const name of ['companionAppByRef', 'companionRememberBindingTarget', 'companionRepairBindings', 'companionBindExternal', 'companionRenameExternal', 'companionOwnerAction']) {
    assert.equal(functionSource(name, bundled), functionSource(name), `${name} must match the private bundle`);
  }
});
