import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

function functionSource(name){
  const start=app.indexOf('function '+name+'(');
  assert.ok(start>=0,'missing '+name);
  const next=app.indexOf('\nfunction ',start+10);
  return app.slice(start,next<0?app.length:next).trim();
}

function compatEnvironment(navigator,standaloneMedia=false){
  const context=vm.createContext({navigator,matchMedia:()=>({matches:standaloneMedia})});
  vm.runInContext(functionSource('appleHomeCompatEnvironment')+';globalThis.result=appleHomeCompatEnvironment();',context);
  return context.result;
}

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

test('manual safe-area mode is available only to Apple home-screen web apps',()=>{
  assert.equal(compatEnvironment({userAgent:'Mozilla/5.0 (iPhone)',platform:'iPhone',maxTouchPoints:5,standalone:true}),true);
  assert.equal(compatEnvironment({userAgent:'Mozilla/5.0 (iPhone)',platform:'iPhone',maxTouchPoints:5,standalone:false}),false,'ordinary iPhone Safari must keep its existing layout');
  assert.equal(compatEnvironment({userAgent:'Mozilla/5.0 (Linux; Android 15)',platform:'Linux armv8l',maxTouchPoints:5,standalone:false},true),false,'Android standalone must never receive the Apple workaround');
  assert.equal(compatEnvironment({userAgent:'Mozilla/5.0 (Macintosh)',platform:'MacIntel',maxTouchPoints:5,standalone:true}),true,'iPad desktop user agent is still supported');
});

test('Apple compatibility switch uses CSS viewport and safe-area insets only',()=>{
  assert.match(functionSource('renderSettings'),/苹果主屏幕适配/);
  assert.match(functionSource('renderSettings'),/Safari 浏览器和安卓始终不受影响/);
  assert.match(html,/html\.north-ios-home-safe[^}]*height:100dvh/);
  assert.match(html,/\.north-ios-home-safe \.home-premium-head\{[^}]*safe-area-inset-top/);
  assert.match(html,/\.north-ios-home-safe \.inputbar\{[^}]*safe-area-inset-bottom/);
  assert.match(html,/\.north-ios-home-safe \.xnav\{[^}]*safe-area-inset-top/);
  assert.match(html,/\.north-ios-home-safe \.music-topbar\{[^}]*safe-area-inset-top/);
  assert.match(html,/\.north-ios-home-safe \.smshead\{[^}]*safe-area-inset-top/);
  assert.match(html,/\.north-ios-home-safe \.dytab\{[^}]*safe-area-inset-bottom/);
  assert.match(html,/\.north-ios-home-safe \.msgbanner\{[^}]*safe-area-inset-top/);
  assert.match(html,/\.north-ios-home-safe \.spybanner\{[^}]*safe-area-inset-top/);
  assert.match(html,/\.north-ios-home-safe \.callscreen\.mini\{[^}]*safe-area-inset-top/);
  assert.match(html,/\.north-ios-home-safe \.cin-nav,html\.north-ios-home-safe \.cin-watch-nav,html\.north-ios-home-safe \.cin-reader-nav,html\.north-ios-home-safe \.dg-nav\{[^}]*safe-area-inset-top/);
});
