import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const swiftRoot = join(root, 'native/private-small-phone/XcodeProject/PhoneCompanionTest');
const wellness = readFileSync(join(swiftRoot, 'CompanionWellnessService.swift'), 'utf8');
const appDelegate = readFileSync(join(swiftRoot, 'PhoneCompanionTestApp.swift'), 'utf8');
const app = readFileSync(join(root, 'app.js'), 'utf8');

test('battery threshold changes request a global snapshot upload', () => {
  assert.match(wellness, /companionUrgentBatterySnapshotRequested/);
  assert.match(wellness, /current <= 5/);
  assert.match(wellness, /current >= 10/);
  assert.match(wellness, /batteryStateText == "充电中"/);
  assert.match(appDelegate, /forName: \.companionUrgentBatterySnapshotRequested/);
  assert.match(appDelegate, /synchronizeCurrentSnapshotIfPaired/);
  assert.match(appDelegate, /refreshUsage: false/);
  assert.match(appDelegate, /applicationDidBecomeActive[\s\S]*synchronizeCurrentSnapshotIfPaired/);
});

test('foreground critical battery is not blocked by the last user message', () => {
  const start = app.indexOf('function companionAutomationMaybeSend(');
  const end = app.indexOf('\nfunction companionGoodMorningSchedule', start);
  const source = app.slice(start, end);
  assert.match(source, /critical=!!\(candidate&&candidate\.kind==='criticalBattery'\)/);
  assert.match(source, /if\(!manual&&!critical&&/);
});
