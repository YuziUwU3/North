import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

test('viewport diagnostics are no longer shown as an Apple bottom-bar settings row',()=>{
  assert.match(app,/const NORTH_VIEWPORT_DIAG=.*northViewportDiag.*==='1'/);
  assert.match(app,/if\(NORTH_VIEWPORT_DIAG\)setTimeout\(northViewportDiagnosticStart,0\)/);
  assert.match(app,/if\(\(!NORTH_VIEWPORT_DIAG&&!force\)\|\|document\.getElementById\('northViewportDiagnostic'\)\)return/);
  assert.doesNotMatch(app,/苹果底栏诊断/);
  assert.doesNotMatch(app,/onclick="northViewportDiagnosticStart\(true\)"/);
});

test('diagnostics capture the real iOS viewport, safe area, shell variables and bottom controls',()=>{
  assert.match(app,/function northViewportSafeInsets\(\)/);
  assert.match(app,/env\(safe-area-inset-bottom,0px\)/);
  assert.match(app,/visualViewport:vv\?/);
  assert.match(app,/homeSafeBottom:root\.getPropertyValue\('--north-ios-home-safe-bottom'\)/);
  assert.match(app,/inputbar:northViewportRect\('\.inputbar'\)/);
  assert.match(app,/tabbar:northViewportRect\('\.tabbar'\)/);
});

test('ordinary startup does not install viewport listeners or render the panel',()=>{
  const boot=app.slice(app.indexOf('function finishAppBoot()'),app.indexOf('\nif(!_coreBootRef)',app.indexOf('function finishAppBoot()')));
  assert.match(boot,/if\(NORTH_VIEWPORT_DIAG\)/);
  assert.doesNotMatch(boot,/northViewportDiagnosticStart\(\)(?![,)]|;)/);
});
