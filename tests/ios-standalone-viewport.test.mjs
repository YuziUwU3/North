import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

test('older iOS standalone snapshots receive a CSS-only bottom fill fallback',()=>{
  assert.match(html,/viewport-fit=cover/);
  assert.match(html,/@supports \(-webkit-touch-callout:none\)\{@media \(display-mode:standalone\) and \(orientation:portrait\)/);
  assert.match(html,/html\{height:-webkit-fill-available\}\.phone,\.screen,body\{min-height:-webkit-fill-available\}/);
  assert.ok(html.indexOf('-webkit-fill-available')>html.indexOf('html,body,.phone,.screen{min-height:100%;min-height:100dvh'),'WebKit fallback must override only the final root sizing rule');
  assert.doesNotMatch(app,/function syncAppViewport|--north-app-height/,'the compatibility fix must not restore the keyboard-sensitive global viewport script');
});
