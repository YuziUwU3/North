import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const app = readFileSync(join(root, 'app.js'), 'utf8');

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

test('large core state migrates to IndexedDB before localStorage reaches its browser quota', () => {
  assert.match(app, /const CORE_IDB_KEY='__core_state',CORE_INLINE_LIMIT=3\.5\*1024\*1024/);
  assert.match(app, /bytes>CORE_INLINE_LIMIT/);
  assert.match(app, /queueCoreMirror\(json,savedAt,true\)/);
  assert.match(app, /imgPut\(CORE_IDB_KEY,\{ver:1,savedAt:job\.savedAt,json:job\.json\}\)/);
  assert.match(app, /writeCoreBootShell\(savedAt\)/);
  assert.match(app, /__coreIdb:\{ver:1,savedAt:/);
  assert.match(app, /async function bootOverflowCore\(\)/);
  assert.match(app, /const rec=await imgGet\(CORE_IDB_KEY\)/);
  assert.match(app, /S=mergeStateData\(restored\)/);
  assert.match(functionSource('bootImages'), /^async function bootImages\(\)\{await bootOverflowCore\(\);try\{/);
  assert.match(app, /if\(_coreBootRef&&!_appBootFinished\)return true/);
});

test('overflow saves are verified asynchronously and failures are rate limited', () => {
  assert.match(app, /function saveNowAsync\(\)/);
  assert.match(app, /_coreMirrorWrite\.then\(Boolean\)/);
  assert.match(app, /_coreQueuedSave=\{json,savedAt,activateOverflow:!!activateOverflow\}/);
  assert.match(app, /while\(_coreQueuedSave\)/);
  assert.match(app, /function storageSaveFailure\(e,largeStore\)/);
  assert.match(app, /now-_storageFailureToastAt>60000/);
  assert.match(app, /now-_storageFailureModalAt>300000/);
  assert.match(app, /大容量存档保存失败/);
  assert.match(app, /无痕\/隐私模式/);
  assert.doesNotMatch(app, /catch\(e\)\{toast\(isQuotaError\(e\)\?'核心存档写不进去了/);
});

test('storage meter distinguishes the compact core index from browser-wide capacity', () => {
  assert.match(app, /overflow=!!_coreOverflowMode/);
  assert.match(app, /大容量存档 '\+si\.logicalMb\.toFixed\(2\)\+'MB/);
  assert.match(app, /不再受5MB核心额度限制/);
  assert.match(app, /coreDanger=!si\.overflow&&si\.pct>=99/);
  assert.match(app, /navigator\.storage&&navigator\.storage\.persist/);
});

test('browser compatibility fallbacks cover clipboard, notifications, DOM replacement and iOS exports', () => {
  assert.match(app, /function copyTextCompat\(text,input\)/);
  assert.match(app, /document\.execCommand&&document\.execCommand\('copy'\)/);
  assert.match(app, /function requestNotificationPermission\(\)/);
  assert.match(app, /Notification\.requestPermission\(finish\)/);
  assert.match(app, /function replaceChildrenCompat\(el,node\)/);
  assert.match(app, /while\(el\.firstChild\)el\.removeChild\(el\.firstChild\)/);
  assert.match(app, /const name='North备份_'[\s\S]*?await beautySaveFile\(blob,name\)/);
  assert.match(app, /await beautySaveFile\(blob,'小手机音乐歌单_/);
  assert.match(app, /r\.onblocked=fail/);
  assert.match(app, /db\.onversionchange=/);
  assert.match(app, /indexedDB\.open\('yibeiMusic',1\)[\s\S]*?r\.onblocked=fail/);
  assert.match(app, /function mPut\(k,b\)[\s\S]*?db\.close\(\)/);
});

test('real save flow keeps only the newest queued large snapshot and restores it', async () => {
  const db = new Map();
  const local = new Map();
  let writes = 0;
  const context = vm.createContext({
    Blob, Date, Promise, setTimeout, clearTimeout,
    localStorage: {
      getItem: key => local.get(key) ?? null,
      setItem: (key, value) => local.set(key, String(value)),
    },
    imgPut: async (key, value) => {
      writes++;
      await new Promise(resolve => setTimeout(resolve, 5));
      db.set(key, value);
    },
    imgGet: async key => db.get(key) ?? null,
    storageSaveFailure: error => { throw error; },
    toast: () => {},
  });
  vm.runInContext(`
    const KEY='north-test',CORE_IDB_KEY='__core_state',CORE_INLINE_LIMIT=3.5*1024*1024;
    let _coreBootRef=null,_coreOverflowMode=false,_coreMirrorWrite=Promise.resolve(true),
      _coreQueuedSave=null,_coreLogicalBytes=0,_coreSavePending=false,_coreFailureAt=0,
      _appBootFinished=true,_saveTimer=null,_savePending=false,_saveLast=0,_saveOkLast=0;
    let S={settings:{},me:{accounts:[]},marker:'first',payload:'x'.repeat(3.6*1024*1024)};
    function defState(){return {settings:{},me:{accounts:[]}}}
    function _imgReplacer(key,value){return value}
    function isQuotaError(){return false}
    function mergeStateData(data){return Object.assign(defState(),data||{})}
    function normalizeLoadedState(){}
  `, context);
  for (const name of ['storedTextBytes', 'coreBootShell', 'writeCoreBootShell', 'queueCoreMirror', 'saveNow', 'bootOverflowCore']) {
    vm.runInContext(functionSource(name), context);
  }

  vm.runInContext(`saveNow();S.marker='second';saveNow();S.marker='newest';saveNow();`, context);
  assert.equal(await vm.runInContext('_coreMirrorWrite', context), true);
  assert.ok(writes <= 2, `expected coalesced writes, got ${writes}`);
  assert.equal(JSON.parse(db.get('__core_state').json).marker, 'newest');
  assert.equal(JSON.parse(local.get('north-test')).__coreIdb.ver, 1);

  vm.runInContext(`S=coreBootShell(Date.now());_appBootFinished=false`, context);
  assert.equal(await vm.runInContext('bootOverflowCore()', context), true);
  assert.equal(vm.runInContext('S.marker', context), 'newest');
});
