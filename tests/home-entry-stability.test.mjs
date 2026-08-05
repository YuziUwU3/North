import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, '小手机.html'), 'utf8');

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false;
  for (let i = brace; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

test('cancelled taps retain the click fallback while real drags stay suppressed', () => {
  const ctx = vm.createContext({
    clearTimeout() {},
    $() { return null; },
  });
  vm.runInContext(`let _aTimer=null,_aFlip=null,_aFlipDir=0,_aPend={k:'douyin'},_aDrag=null,_aNoClick=7;${functionSource('appCancel')};globalThis.api={cancel:appCancel,noClick:()=>_aNoClick,setDrag:v=>{_aDrag=v}};`, ctx);
  ctx.api.cancel();
  assert.equal(ctx.api.noClick(), 7, 'a simple pointercancel must not block the browser click fallback');
  ctx.api.setDrag({ ghost: { remove() {} } });
  ctx.api.cancel();
  assert.ok(ctx.api.noClick() > 7, 'a real drag must still suppress the trailing click');
});

test('pointerup launches on the next task so WeChat cannot click through into a chat', () => {
  const queued = [];
  const calls = [];
  const ctx = vm.createContext({
    appLocked: () => false,
    toast() {},
    LOCKABLE: {},
    APPRUN: { wechat: () => calls.push('wechat'), douyin: () => calls.push('douyin') },
    setTimeout: fn => { queued.push(fn); return queued.length; },
  });
  vm.runInContext(`let _aNoClick=0;${functionSource('appLaunch')};globalThis.appLaunch=appLaunch;`, ctx);
  ctx.appLaunch('wechat');
  assert.deepEqual(calls, [], 'the page must not change inside pointerup');
  assert.equal(queued.length, 1);
  queued.shift()();
  assert.deepEqual(calls, ['wechat']);
  assert.match(functionSource('openWeChat'), /wxTab=tab\|\|'chats';go\('wechat'\)/);
});

test('Douyin repairs incomplete restored data every time it opens', () => {
  const ctx = vm.createContext({ S: { dy: { profile: null, feed: 'legacy', users: [] } } });
  vm.runInContext(`${functionSource('dyInit')};globalThis.dyInit=dyInit;`, ctx);
  assert.equal(ctx.dyInit(), true);
  for (const key of ['feed', 'liked', 'following', 'dms', 'history', 'mine']) assert.ok(Array.isArray(ctx.S.dy[key]), key);
  assert.deepEqual({ ...ctx.S.dy.profile }, { nick: '', avatar: null, bio: '记录美好生活✨' });
  assert.deepEqual({ ...ctx.S.dy.users }, {});
  assert.equal(ctx.dyInit(), false, 'a repaired store must remain stable');
  assert.match(functionSource('openDouyin'), /if\(dyInit\(\)\)save\(0\)/);
  assert.match(functionSource('renderDouyin'), /^function renderDouyin\(\)\{dyInit\(\)/);
});

test('the four-icon dock and page dots stay fixed above scrollable home content', () => {
  assert.match(source, /<div class="home-scroll">\$\{homeWidgets\(\)\}[\s\S]*?<div class="appswipe"/);
  assert.match(html, /\.home\{[^}]*overflow:hidden/);
  assert.match(html, /\.home-scroll\{[^}]*flex:1;[^}]*overflow-y:auto/);
  assert.match(html, /\.pgdots\{position:relative;[^}]*flex:none/);
  assert.match(html, /\.dock\{position:relative;[^}]*flex:none/);
  assert.doesNotMatch(html, /\.apps,\.dock\{position:relative/);
});

test('preferences adjust all home app icons and labels with portable state', () => {
  assert.match(source, /function homeAppAppearanceVars\(\)/);
  assert.match(source, /id="homeAppIconTone" type="range"/);
  assert.match(source, /id="homeAppTextTone" type="range"/);
  assert.match(source, /homeAppAppearanceSet\('icon',this\.value\)/);
  assert.match(source, /homeAppAppearanceSet\('text',this\.value\)/);
  assert.match(source, /'appIconTone','appTextTone'/);
  assert.match(html, /\.home \.app \.ic\{filter:brightness\(var\(--home-app-icon-tone,100%\)\)/);
  assert.match(html, /\.home \.app>span\{opacity:var\(--home-app-text-opacity,1\);\}/);
});
