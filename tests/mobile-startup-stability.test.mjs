import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
  const boot = functionSource('bootImages');
  assert.match(boot, /_imgCache=await imgMany\(imageRefKeys\(S\)\)/);
  assert.doesNotMatch(boot, /await imgAll\(\)/);
});

test('stored avatar references render safely and refresh incoming call UI', () => {
  assert.match(functionSource('av'), /isStoredImgRef\(v\)/);
  assert.match(functionSource('av'), /data-idb-avatar/);
  assert.match(functionSource('refreshHydratedUI'), /showCallBanner\(c\)/);
  assert.match(app, /else refreshHydratedUI\(\)/);
});

test('mobile viewport and desktop pages self-correct after resume and swipes', () => {
  assert.match(html, /height:var\(--north-app-height,100dvh\)/);
  assert.match(functionSource('syncAppViewport'), /--north-app-height/);
  assert.match(app, /window\.addEventListener\('pageshow',e=>\{syncAppViewport\(\)/);
  assert.match(html, /scroll-snap-stop:always/);
  assert.match(functionSource('homeSnapPage'), /p\*w/);
  assert.match(functionSource('homeRestorePage'), /_homePage\*\(el\.clientWidth\|\|1\)/);
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
