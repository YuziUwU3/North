import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=read('app.js');
const html=read('小手机.html');
const sw=read('sw.js');

test('Safari system-owned gap uses the restored pre-repair shell contract',()=>{
  assert.doesNotMatch(app,/north-ios-pwa-shell/);
  assert.doesNotMatch(html,/html\.north-ios-pwa-shell \.phone/);
  assert.doesNotMatch(html,/north_pwa_system_bar_color|--north-system-bar-color|north-ios-pwa-bottom/);
  assert.doesNotMatch(app,/pwaWallpaperBottomColor|pwaSystemBarSync|__NORTH_SYSTEM_BAR_COLOR__/);
  assert.match(html,/--north-ios-home-safe-bottom:0px/);
  assert.match(html,/background-color:#000/);
});

test('Apple compatibility moves only Apple lock arrows and leaves Android geometry untouched',()=>{
  assert.match(html,/html\.north-ios-home-safe \.lockpull\{top:calc\(7px \+ var\(--north-ios-home-safe-top\)\)\}/);
  assert.match(html,/html\.north-native-app\.north-apple-remote-safe \.lockpull\{top:calc\(7px \+ var\(--north-native-safe-top,0px\)\)\}/);
  assert.doesNotMatch(html,/html:not\(\.north-ios-home-safe\).*\.lockpull/);
  assert.match(app,/cur\(\)\.p==='home'&&homePageClamp\(_homePage\)===0&&!_call/,'the web and private-app arrow exists only on home page one');
  assert.match(app,/function homePageDots\(p\)[\s\S]*?renderLockPull\(\);\}/,'page swipes refresh arrow visibility immediately');
  assert.match(app,/function appleHomeCompatBrowserEnvironment\(\)/);
  assert.match(app,/classList\.remove\('north-ios-home-safe'\)/);
  assert.doesNotMatch(app,/苹果兼容适配|appleHomeCompatToggle/);
  assert.match(app,/window\.addEventListener\('pageshow',lockPullRefresh/);
  assert.match(app,/document\.addEventListener\('visibilitychange',[\s\S]*lockPullRefresh\(\)/);
});

test('Apple standalone glass home reserves a separate arrow lane without shifting Android or native app',()=>{
  const glass=read('glass-theme.css');
  assert.match(glass,/html\.north-ios-home-safe\.north-glass-ui \.home \.home-scroll\{padding-top:calc\(var\(--north-ios-home-safe-top\) \+ 25px\)\}/);
  assert.doesNotMatch(glass,/html\.north-native-app[^}]*\.home-scroll/);
});

test('all glass icons are precached and retain an inline fallback',()=>{
  assert.match(sw,/const GLASS_ICON_PACKS=\['black','gray','pink','blue'\]/);
  assert.match(sw,/const GLASS_ICON_KEYS=\[/);
  assert.match(sw,/GLASS_ICON_FILES\.slice\(i,i\+8\)/);
  assert.match(sw,/cache\.match\(request,\{ignoreSearch:true\}\)/);
  assert.match(app,/class="app-icon-fallback"/);
  assert.match(app,/decoding="sync" loading="eager" fetchpriority="high"/);
  assert.match(app,/onerror="this\.style\.display='none'"/);
});
