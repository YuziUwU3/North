import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const swift = readFileSync(join(
  root,
  'native',
  'phone-companion-v857',
  'Xcode主App文件',
  'CompanionSyncView.swift',
), 'utf8');
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

test('returning to the foreground rechecks Family Controls without silently prompting', () => {
  const start = swift.indexOf('.onChange(of: scenePhase)');
  const end = swift.indexOf('.onChange(of: pushCoordinator.deviceToken)', start);
  const foreground = swift.slice(start, end);
  assert.match(foreground, /await service\.refreshDataAccessState\(\)/);
  assert.ok(
    foreground.indexOf('refreshDataAccessState()') < foreground.indexOf('service.synchronize('),
  );
  assert.doesNotMatch(foreground, /requestAuthorization/);
  assert.match(swift, /Button\("重新授权屏幕使用时间"\)/);
});

test('live usage reading is bounded and a timeout still uploads compatibility data', () => {
  assert.match(swift, /usageReadTimeoutNanoseconds/);
  assert.match(swift, /fetchTodayDirectUsageWithTimeout/);
  assert.match(swift, /group\.cancelAll\(\)/);
  assert.match(swift, /case \.timedOut:/);
  assert.match(swift, /读取超过 8 秒，已跳过使用量并继续上传其他真实数据/);
});

test('automatic five-second sync does not start heavyweight live usage reads', () => {
  const start = swift.indexOf('fileprivate func synchronize(');
  const end = swift.indexOf('fileprivate func synchronizeCommandsOnly(', start);
  const fullSync = swift.slice(start, end);
  assert.doesNotMatch(fullSync, /automaticUsageRefreshDue/);
  assert.match(fullSync, /if refreshUsage \{/);
});

test('configured ManagedSettings state is not presented as verified enforcement', () => {
  assert.doesNotMatch(swift, /由系统设置读回确认/);
  assert.match(swift, /屏蔽配置已写入；最终是否生效请以打开目标 App 时的系统屏蔽页为准/);
  const state = functionSource('companionExternalCommandState');
  assert.doesNotMatch(state, /回报已锁|新快照确认锁定/);
  assert.match(state, /设备配置含锁/);
  assert.match(state, /等待真机打开目标 App 验证/);
  assert.doesNotMatch(app, /设备回报已锁|新快照确认锁定/);
  assert.match(app, /设备配置含锁/);
});
