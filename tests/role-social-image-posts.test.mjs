import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../小手机.html', import.meta.url), 'utf8');

function functionSource(name) {
  const marker = `function ${name}(`;
  const markerStart = app.indexOf(marker);
  assert.notEqual(markerStart, -1, `${name} should exist`);
  const start = app.slice(Math.max(0, markerStart - 6), markerStart) === 'async ' ? markerStart - 6 : markerStart;
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

test('role decides whether a concrete Moment or X post needs an image', () => {
  const plan = functionSource('roleSocialVisualPlan');
  assert.match(plan, /!S\.settings\.imgGen\|\|!imageGenerationAvailable\(\)/, 'disabled or unconfigured image generation must skip the image call');
  assert.match(plan, /roleSocialVisualPrompt/, 'the role model makes the visual decision');
  assert.match(functionSource('roleSocialVisualPrompt'), /纯心情、抽象感想、关系表态/);
  assert.match(functionSource('publishRoleSocialAutonomous'), /await roleSocialImages\(c,platform,text\)/, 'publishing waits for image generation before writing the post');
});

test('failed social image generation retries exactly once and then falls back to text', async () => {
  let calls = 0;
  const context = vm.createContext({
    roleSocialVisualPlan: async () => ({ useImage: true, imagePrompt: '雨夜街灯' }),
    roleSocialImagePrompt: () => 'prompt',
    genImage: async () => { calls++; throw new Error('upstream failed'); },
    stableImageSrc: async value => value
  });
  vm.runInContext(functionSource('roleSocialImages'), context);
  const images = await context.roleSocialImages({}, 'moment', '雨夜回家');
  assert.deepEqual([...images], []);
  assert.equal(calls, 2, 'one initial attempt plus one automatic retry');
});

test('successful retry publishes one real image while publication supports text fallback', async () => {
  let calls = 0;
  const context = vm.createContext({
    roleSocialVisualPlan: async () => ({ useImage: true, imagePrompt: '桌上的咖啡' }),
    roleSocialImagePrompt: () => 'prompt',
    genImage: async () => { calls++; if (calls === 1) throw new Error('temporary'); return 'https://img.example/coffee.jpg'; },
    stableImageSrc: async value => value
  });
  vm.runInContext(functionSource('roleSocialImages'), context);
  const images = await context.roleSocialImages({}, 'x', '今晚的咖啡');
  assert.deepEqual([...images], ['https://img.example/coffee.jpg']);
  assert.equal(calls, 2);
  assert.match(functionSource('publishRoleMoment'), /Array\.isArray\(opt\.images\)/);
  assert.match(functionSource('publishRoleTweet'), /Array\.isArray\(opt\.images\)/);
});

test('all autonomous role post entry points use the shared media pipeline', () => {
  assert.match(functionSource('doAutoMoment'), /publishRoleSocialAutonomous\(c,'moment'/);
  assert.match(functionSource('doAutoTweet'), /publishRoleSocialAutonomous\(c,'x'/);
  assert.match(functionSource('refreshMoments'), /publishRoleSocialAutonomous\(c,'moment'/);
  assert.match(functionSource('doGenContactTweet'), /publishRoleSocialAutonomous\(c,'x'/);
  assert.match(functionSource('genUserTweet'), /publishRoleSocialAutonomous\(isC,'x'/);
});

test('profile ellipsis uses a compact realistic spacing', () => {
  assert.match(html, /\.wx-real-nav button:last-child\{[^}]*letter-spacing:-1\.5px/);
  assert.match(app, /aria-label="联系人设置">•••<\/button>/);
});
