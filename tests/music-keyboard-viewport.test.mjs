import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');

function viewportSource() {
  const start = app.indexOf('let _mChatViewportHeight=');
  const endMark = "window.addEventListener('resize',musicChatViewportResize,{passive:true});";
  const end = app.indexOf(endMark, start);
  assert.ok(start >= 0 && end > start, 'missing music keyboard viewport helpers');
  return app.slice(start, end + endMark.length);
}

function harness() {
  const queued = [];
  const root = { scrollTop: 61, scrollLeft: 7 };
  const documentElement = { scrollTop: 62, clientHeight: 800 };
  const body = { scrollTop: 63, scrollLeft: 9 };
  let playerPresent = true;
  const listeners = {};
  const sandbox = {
    document: {
      scrollingElement: root,
      documentElement,
      body,
      querySelector: selector => selector === '.music-premium' && playerPresent ? {} : null,
    },
    window: {
      innerHeight: 800,
      scrollTo: (x, y) => { sandbox.window.lastScroll = [x, y]; },
      addEventListener: (name, fn) => { listeners[name] = fn; },
    },
    setTimeout: fn => { queued.push(fn); return queued.length; },
    clearTimeout: () => {},
  };
  vm.createContext(sandbox);
  vm.runInContext(`let _mView='player';${viewportSource()};globalThis.api={
    reset:musicViewportReset,
    focus:musicChatViewportFocus,
    blur:musicChatViewportBlur,
    resize:musicChatViewportResize,
    setView:v=>{_mView=v},
    focused:()=>_mChatViewportFocused,
    baseline:()=>_mChatViewportHeight
  };`, sandbox);
  return { sandbox, root, documentElement, body, listeners, queued, setPlayerPresent: value => { playerPresent = value; } };
}

test('music player resets only its residual document pan', () => {
  const h = harness();
  assert.equal(h.sandbox.api.reset(), true);
  assert.equal(h.root.scrollTop, 0);
  assert.equal(h.root.scrollLeft, 0);
  assert.equal(h.documentElement.scrollTop, 0);
  assert.equal(h.body.scrollTop, 0);
  assert.equal(h.body.scrollLeft, 0);
  assert.deepEqual(h.sandbox.window.lastScroll, [0, 0]);

  h.root.scrollTop = 42;
  h.sandbox.api.setView('home');
  assert.equal(h.sandbox.api.reset(), false);
  assert.equal(h.root.scrollTop, 42);

  h.sandbox.api.setView('player');
  h.setPlayerPresent(false);
  assert.equal(h.sandbox.api.reset(), false);
  assert.equal(h.root.scrollTop, 42);
});

test('keyboard recovery waits for viewport height to rebound', () => {
  const h = harness();
  assert.equal(typeof h.listeners.resize, 'function');
  h.sandbox.api.focus();
  assert.equal(h.sandbox.api.focused(), true);
  assert.equal(h.sandbox.api.baseline(), 800);

  h.root.scrollTop = 55;
  h.sandbox.window.innerHeight = 520;
  h.documentElement.clientHeight = 520;
  h.listeners.resize();
  assert.equal(h.root.scrollTop, 55, 'keyboard-open resize must not snap the page');

  h.sandbox.window.innerHeight = 800;
  h.documentElement.clientHeight = 800;
  h.listeners.resize();
  assert.equal(h.root.scrollTop, 0, 'restored height must clear the residual upward pan');
  assert.equal(h.queued.length, 3, 'settling passes handle delayed browser keyboard animation');

  h.root.scrollTop = 28;
  h.sandbox.api.blur();
  assert.equal(h.sandbox.api.focused(), false);
  assert.equal(h.root.scrollTop, 0);
});

test('music input owns the recovery hooks without restoring a global viewport hack', () => {
  assert.match(app, /id="m_chat"[^>]*onfocus="musicChatViewportFocus\(\)"[^>]*onblur="musicChatViewportBlur\(\)"/);
  assert.match(app, /function musicToggleChat\(\)[\s\S]*?input\.blur\(\)[\s\S]*?musicChatViewportBlur\(\)/);
  const ordinaryApp=app.replace(/function northViewportDiagnosticStart\([^\n]*\n/,'');
  assert.doesNotMatch(ordinaryApp, /visualViewport\.addEventListener\(['"](?:resize|scroll)['"]/, 'the optional diagnostic observer is not a keyboard layout hook');
  assert.doesNotMatch(app, /--north-app-height/);
});
