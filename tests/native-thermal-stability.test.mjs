import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'glass-theme.css'),'utf8');
const sync=fs.readFileSync(path.join(root,'native/private-small-phone/XcodeProject/PhoneCompanionTest/CompanionSyncView.swift'),'utf8');

test('private WKWebView does not create a backdrop compositor layer for every card and bubble',()=>{
  assert.match(css,/north-native-app\.north-glass-ui \.phone \*[\s\S]*?backdrop-filter:none!important/);
  assert.match(css,/north-native-app\.north-glass-ui \.phone \*::before/);
  assert.match(css,/north-native-app\.north-glass-ui \.phone \*::after/);
});

test('iPhone Safari and PWA receive the same compositor protection without changing Android',()=>{
  assert.match(app,/const NORTH_IOS_WEBKIT=/);
  assert.match(app,/classList\.toggle\('north-ios-webkit',NORTH_IOS_WEBKIT\)/);
  assert.match(css,/north-ios-webkit\.north-glass-ui \.phone \*[\s\S]*?backdrop-filter:none!important/);
  assert.doesNotMatch(css,/north-android\.north-glass-ui \.phone \*[\s\S]*?backdrop-filter:none!important/);
});

test('the lightweight native status poll does not repeatedly refresh Screen Time or HealthKit',()=>{
  assert.match(sync,/if wantsUsage \{\s*await refreshDataAccessState\(\)\s*\}/);
  assert.match(sync,/if wantsHealth \{\s*wellnessReadCompleted = await refreshWellnessWithTimeout/);
  assert.match(sync,/else \{\s*wellnessReadCompleted = true\s*\}/);
  assert.match(app,/companionNativeSnapshot\(\s*'\u72b6态'/);
});

test('idle clock work skips hidden pages and never rebuilds an unchanged lock-screen SVG mask',()=>{
  assert.match(app,/function northUiClockTick\(\)\{if\(typeof document!==['"]undefined['"]&&document\.hidden\)return/);
  assert.match(app,/function renderLockClock\(force\)[\s\S]*?_lockClockPaintKey===key[\s\S]*?return/);
  assert.match(app,/if\(b\.textContent!==value\)b\.textContent=value/);
});
