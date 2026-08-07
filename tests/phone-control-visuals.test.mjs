import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const app = readFileSync(join(root, 'app.js'), 'utf8');
const html = readFileSync(join(root, '小手机.html'), 'utf8');

test('locked apps are visually disabled without an emoji label', () => {
  assert.ok(app.includes(`class="app home-item'+(locked?' app-locked':'')+'"`));
});

test('locked apps use a line lock and reject home-screen launches', () => {
  assert.match(app, /class="app-lock-line"/);
  assert.match(app, /aria-disabled="/);
  assert.match(app, /if\(appLocked\(k\)\)\{toast\('「'/);
  assert.match(app, /function appLaunch\(k\)[\s\S]*?if\(appLocked\(k\)\)/);
  assert.doesNotMatch(app, /function appLk\(key\)\{return appLocked\(key\)\?'🔒'/);
  assert.match(html, /\.app\.app-locked/);
  assert.match(html, /\.app-lock-line/);
});

test('wechat login lock screen uses animated line art and a red countdown', () => {
  const screen = app.match(/function wxLockedScreen\(\)[\s\S]*?\n\}/)?.[0] || '';
  assert.match(screen, /wxlogin-lockscreen/);
  assert.match(screen, /wxlogin-line-lock/);
  assert.match(screen, /wxlogin-countdown/);
  assert.doesNotMatch(screen, /🔒/);
  assert.match(html, /@keyframes wxloginGrid/);
  assert.match(html, /\.wxlogin-countdown\{[^}]*color:#ff334b/);
});

test('phone viewing banner uses a red recording indicator without emoji', () => {
  const spy = app.match(/async function doSpyView[\s\S]*?if\(!S\._spySeen\)/)?.[0] || '';
  assert.match(spy, /spy-monitor-dot/);
  assert.match(spy, /spy-monitor-text/);
  assert.doesNotMatch(spy, /👁️|✅/);
  assert.match(html, /\.spy-monitor-dot\{[^}]*background:#ff253f/);
  assert.match(html, /@keyframes spyScan/);
});

test('wechat login and logout omit redundant visible notices', () => {
  const login = app.match(/function wxDoLogin\(cid\)[\s\S]*?(?=\nfunction wxLogout\(\))/)?.[0] || '';
  const logout = app.match(/function wxLogout\(\)[\s\S]*?(?=\nasync function wxLoginSession)/)?.[0] || '';
  const screen = app.match(/function wxLockedScreen\(\)[\s\S]*?\n\}/)?.[0] || '';
  assert.doesNotMatch(login, /toast\(/);
  assert.doesNotMatch(logout, /type:'sys'/);
  assert.doesNotMatch(screen, /ta能看到你的一切/);
  assert.match(app, /function repairWxLogoutEmoji\(\)[\s\S]*?\.filter\(/);
  assert.match(app, /登录了你的微信\|退出了你的微信登录/);
});
