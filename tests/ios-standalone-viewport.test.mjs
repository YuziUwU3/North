import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

test('full-screen shell is capped to the current available viewport',()=>{
  assert.match(html,/viewport-fit=cover/);
  assert.match(html,/html,body,.phone,.screen\{height:100%;min-height:0;max-height:100%;overflow:hidden\}/);
  assert.match(html,/#app\{flex:1;position:relative;overflow:hidden;display:flex;flex-direction:column;min-height:0;\}/);
  assert.match(html,/\.page\{position:absolute;inset:0;display:flex;flex-direction:column;overflow:hidden;\}/);
});

test('chat content scrolls inside the shell while the composer keeps its row',()=>{
  assert.match(html,/\.chatbg\{flex:1;overflow-y:auto;/);
  assert.match(html,/\.inputbar\{flex:0 0 auto;/);
});

test('no script may substitute physical screen height for the app viewport',()=>{
  assert.doesNotMatch(html,/--north-shell-height|north-standalone-shell|__northStandaloneShellSync/);
  assert.doesNotMatch(html,/screen\.height/);
  assert.doesNotMatch(html,/min-height:-webkit-fill-available/);
  assert.doesNotMatch(app,/function syncAppViewport|--north-app-height/,'do not restore the keyboard-sensitive global viewport script');
});
