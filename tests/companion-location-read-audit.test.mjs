import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const swift=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/CompanionSyncView.swift',import.meta.url),'utf8');

test('native location read waits for a fresh callback and returns the real failure reason',()=>{
  assert.match(swift,/Date\(\)\.addingTimeInterval\(8\)/);
  assert.match(swift,/250_000_000/);
  assert.match(swift,/locationManager\.lastError/);
  assert.match(swift,/readErrors\["location"\]/);
});

test('every local role location read writes a visible completed-or-failed device audit entry',()=>{
  const begin=app.indexOf('async function companionRolePullLatest(');
  const end=app.indexOf('function companionRoleDataState(',begin);
  const block=app.slice(begin,end);
  assert.match(block,/action=\/定位\|位置\//);
  assert.match(block,/companionLog\(config,action/);
  assert.match(block,/actorContact/);
  assert.match(block,/log\.status=ok\?'completed':'failed'/);
  assert.match(block,/log\.transport='local-native'/);
  assert.match(block,/log\.error=/);
});
