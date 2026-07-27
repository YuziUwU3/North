import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../小手机.html', import.meta.url), 'utf8');

function functionSource(name) {
  const asyncStart = app.indexOf(`async function ${name}`);
  const start = asyncStart >= 0 ? asyncStart : app.indexOf(`function ${name}`);
  assert.ok(start >= 0, `missing ${name}`);
  const brace = app.indexOf('{', start);
  let depth = 0, quote = '', escaped = false;
  for (let i = brace; i < app.length; i++) {
    const ch = app[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return app.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

test('startup only hydrates images referenced by the restored state', () => {
  assert.match(app, /function imageRefKeys\(root\)/);
  assert.match(app, /function imgMany\(keys\)/);
  assert.match(app, /function imgManyChunk\(keys\)/);
  assert.match(functionSource('imgMany'), /i\+=48/);
  assert.match(functionSource('imgMany'), /j\+=12/);
  const boot = functionSource('bootImages');
  assert.match(boot, /_imgCache=await imgMany\(imageRefKeys\(S\)\)/);
  assert.doesNotMatch(boot, /await imgAll\(\)/);
});

test('stored avatar references render safely and refresh incoming call UI', () => {
  assert.match(functionSource('isImg'), /blob:/);
  assert.match(functionSource('av'), /isStoredImgRef\(v\)/);
  assert.match(functionSource('av'), /_imgCache\[key\]/);
  assert.match(functionSource('av'), /data-idb-avatar/);
  assert.match(functionSource('refreshHydratedUI'), /showCallBanner\(c\)/);
  assert.match(app, /else refreshHydratedUI\(\)/);
});

test('viewport follows Android browser chrome shrink but ignores a temporary keyboard shrink', () => {
  const style = { value: '', setProperty(_k, v) { this.value = v; }, removeProperty() { this.value = ''; } };
  const visual = { scale: 1, height: 852 };
  const context = {
    window: { innerHeight: 852, innerWidth: 393, visualViewport: visual, matchMedia: () => ({ matches: false }) },
    visualViewport: visual,
    navigator: { standalone: false },
    matchMedia: () => ({ matches: false }),
    document: { documentElement: { style, clientHeight: 852 }, activeElement: null },
    Math
  };
  vm.runInNewContext(`let _appViewportHeight=0,_appViewportOrientation='';\n${functionSource('appVisibleViewportHeight')}\n${functionSource('syncAppViewport')}\nsyncAppViewport()`, context);
  assert.equal(style.value, '852px');
  context.window.innerHeight = 700;
  visual.height = 700;
  vm.runInNewContext('syncAppViewport()', context);
  assert.equal(style.value, '700px');
  context.document.activeElement = { tagName: 'INPUT', isContentEditable: false };
  context.window.innerHeight = 420;
  visual.height = 420;
  vm.runInNewContext('syncAppViewport()', context);
  assert.equal(style.value, '700px');
});

test('mobile viewport and desktop pages self-correct after resume and swipes', () => {
  assert.match(html, /height:var\(--north-app-height,100dvh\)/);
  const viewport = functionSource('syncAppViewport');
  assert.match(viewport, /appVisibleViewportHeight\(\)/);
  assert.match(viewport, /_appViewportHeight=Math\.round\(h\)/);
  assert.doesNotMatch(viewport, /screen\.height/);
  assert.doesNotMatch(viewport, /Math\.max\(_appViewportHeight/);
  assert.match(app, /window\.addEventListener\('pageshow',e=>\{syncAppViewport\(\)/);
  assert.match(html, /scroll-snap-stop:always/);
  assert.match(html, /\.scroll\{flex:1;min-height:0;[^}]*touch-action:pan-y/);
  assert.match(html, /\.appswipe\{[^}]*touch-action:pan-x/);
  assert.match(functionSource('homeSnapPage'), /p\*w/);
  assert.match(functionSource('homeRestorePage'), /_homePage\*\(el\.clientWidth\|\|1\)/);
});

test('cinema offers a user-triggered Android system fullscreen fallback', () => {
  assert.match(app, /data-cin-action="fullscreen"/);
  assert.match(functionSource('cinemaControlTap'), /a==='fullscreen'\)cinemaToggleFullscreen\(\)/);
  assert.match(functionSource('cinemaToggleFullscreen'), /requestFullscreen/);
  assert.match(functionSource('cinemaToggleFullscreen'), /orientation\.lock\('landscape'\)/);
  assert.match(app, /document\.addEventListener\('fullscreenchange',cinemaFullscreenChanged\)/);
});

test('new couple defaults are enabled without replacing an active bound role', () => {
  const defaults = functionSource('coupleDefaultState');
  assert.match(defaults, /walletAuth:true/);
  assert.match(defaults, /jailAuth:true/);
  assert.match(defaults, /wxLoginAuth:true/);
  assert.match(defaults, /remoteControlAuth:true/);
  assert.match(defaults, /remoteControlAutoApprove:true/);
  assert.match(defaults, /escalate:true/);
  assert.match(functionSource('coupleHasActiveRole'), /!c\.deleted/);
});
