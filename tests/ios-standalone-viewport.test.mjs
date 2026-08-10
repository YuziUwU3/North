import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const nativeRoot=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/SmallPhonePrivateRootView.swift',import.meta.url),'utf8');

function functionSource(name){
  const start=app.indexOf('function '+name+'(');
  assert.ok(start>=0,'missing '+name);
  const next=app.indexOf('\nfunction ',start+10);
  return app.slice(start,next<0?app.length:next).trim();
}

function compatEnvironment(navigator,standaloneMedia=false,privateApp=false){
  const context=vm.createContext({navigator,matchMedia:()=>({matches:standaloneMedia}),window:{__SMALL_PHONE_PRIVATE__:privateApp}});
  vm.runInContext(functionSource('appleHomeCompatEnvironment')+';globalThis.result=appleHomeCompatEnvironment();',context);
  return context.result;
}

function compatOn(setting=false,privateApp=false){
  const context=vm.createContext({S:{settings:{appleHomeCompat:setting}},window:{__SMALL_PHONE_PRIVATE__:privateApp}});
  vm.runInContext(functionSource('appleHomeCompatOn')+';globalThis.result=appleHomeCompatOn();',context);
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
  assert.equal(compatEnvironment({userAgent:'Private WKWebView',platform:'iPhone',maxTouchPoints:5,standalone:false},false,true),false,'the native app must not reuse the browser-only layout workaround');
  assert.equal(compatOn(true,true),false,'the native app must ignore a restored browser setting');
  assert.equal(compatOn(false,false),false,'the ordinary browser keeps its existing opt-in behavior');
});

test('Apple compatibility switch preserves the proven shell and guarantees nonzero safe areas',()=>{
  assert.match(functionSource('renderSettings'),/苹果主屏幕适配/);
  assert.match(functionSource('renderSettings'),/Safari 浏览器和安卓始终不受影响/);
  assert.match(html,/html\.north-ios-home-safe\{--north-ios-home-safe-top:max\(env\(safe-area-inset-top,0px\),47px\);--north-ios-home-safe-bottom:max\(env\(safe-area-inset-bottom,0px\),34px\)\}/);
  assert.doesNotMatch(html,/html\.north-ios-home-safe[^}]*height:100dvh/,'the opt-in must not replace the stable 100% shell with a second viewport model');
  assert.match(html,/\.north-ios-home-safe \.home-premium-head\{[^}]*var\(--north-ios-home-safe-top\)/);
  assert.match(html,/\.north-ios-home-safe \.inputbar\{[^}]*var\(--north-ios-home-safe-bottom\)/);
  assert.match(html,/\.north-ios-home-safe \.xnav\{[^}]*var\(--north-ios-home-safe-top\)/);
  assert.match(html,/\.north-ios-home-safe \.music-topbar\{[^}]*var\(--north-ios-home-safe-top\)/);
  assert.match(html,/\.north-ios-home-safe \.smshead\{[^}]*var\(--north-ios-home-safe-top\)/);
  assert.match(html,/\.north-ios-home-safe \.dytab\{[^}]*var\(--north-ios-home-safe-bottom\)/);
  assert.match(html,/\.north-ios-home-safe \.msgbanner\{[^}]*var\(--north-ios-home-safe-top\)/);
  assert.match(html,/\.north-ios-home-safe \.spybanner\{[^}]*var\(--north-ios-home-safe-top\)/);
  assert.match(html,/\.north-ios-home-safe \.callscreen\.mini\{[^}]*var\(--north-ios-home-safe-top\)/);
  assert.match(html,/\.north-ios-home-safe \.cin-nav,html\.north-ios-home-safe \.cin-watch-nav,html\.north-ios-home-safe \.cin-reader-nav,html\.north-ios-home-safe \.dg-nav\{[^}]*var\(--north-ios-home-safe-top\)/);
  assert.match(app,/class="nav shop-nav"/);
  assert.match(app,/class="nav food-nav"/);
  assert.match(html,/\.north-ios-home-safe \.shop-nav,html\.north-ios-home-safe \.food-nav\{[^}]*var\(--north-ios-home-safe-top\)/);
  assert.match(app,/class="dynav dy-safe-nav"/);
  assert.match(app,/class="dy-feed-back"/);
  assert.match(html,/\.north-ios-home-safe \.dy-safe-nav\{[^}]*var\(--north-ios-home-safe-top\)/);
  assert.match(html,/\.north-ios-home-safe \.dy-feed-back\{[^}]*var\(--north-ios-home-safe-top\)/);
  assert.match(app,/class="travel-app"/);
  assert.match(app,/class="travel-head"/);
  assert.match(html,/\.north-ios-home-safe \.travel-head\{[^}]*var\(--north-ios-home-safe-top\)/);
  assert.match(html,/html\.north-native-app \.phone\{position:fixed;inset:0/);
  assert.doesNotMatch(html,/\.north-native-app\.north-ios-home-safe/,'native pages keep the proven browser layout instead of per-app offsets');
  assert.match(nativeRoot,/\.ignoresSafeArea\(\.container, edges: \.bottom\)/,'the native container reserves the entire tappable top safe area');
  assert.doesNotMatch(nativeRoot,/\.ignoresSafeArea\(\)/,'the web view must never extend under the iPhone status bar');
});
