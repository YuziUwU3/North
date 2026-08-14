import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

function functionSource(name,nextName){
  const start=source.indexOf('function '+name+'(');
  const end=source.indexOf('\nfunction '+nextName+'(',start);
  assert.ok(start>=0&&end>start,'missing '+name);
  return source.slice(start,end);
}

test('idle reminders never navigate away from the page the user is viewing',()=>{
  const idle=functionSource('handleIdleEvent','handleExternalEvent');
  assert.doesNotMatch(idle,/openChat\s*\(/);
  assert.doesNotMatch(idle,/\bhome\s*\(/);
  assert.match(idle,/不要改变ta当前正在看的页面/);
  assert.match(idle,/绝不能替ta切换页面或要求程序打开聊天页/);
  assert.match(idle,/scheduleReply\(c\.id/);
});
