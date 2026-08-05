import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

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

test('incoming media ringtone loops one sustained soft tone without a long silent gap', () => {
  const media = { loop: false, currentTime: 4, pauseCalls: 0, pause() { this.pauseCalls++; } };
  const played = [], web = [], timers = [], vibrations = [];
  const ctx = vm.createContext({
    S: { settings: { sound: true } },
    navigator: { vibrate: pattern => vibrations.push(pattern) },
    playMediaTone(seq, opt) { played.push({ seq, opt }); media.loop = !!opt.loop; return media; },
    webToneSequence(seq, opt) { web.push({ seq, opt }); return true; },
    setInterval(fn, ms) { timers.push({ fn, ms }); return 41; },
    clearInterval() {},
  });
  vm.runInContext(`let _ring=null;function ringStop(){_ring=null;}${functionSource('ringStart')};globalThis.api={start:ringStart,ring:()=>_ring};`, ctx);

  ctx.api.start();
  assert.deepEqual(JSON.parse(JSON.stringify(played[0].seq)), [[880, 1.2]]);
  assert.equal(played[0].opt.loop, true);
  assert.equal(played[0].opt.gap, 0);
  assert.equal(played[0].opt.decay, false);
  assert.equal(played[0].opt.sustain, true);
  assert.equal(played[0].opt.level, 0.07);
  assert.match(played[0].opt.key, /continuous-soft-v4/);
  assert.equal(timers.length, 0, 'the primary HTMLAudio loop must not also start a timer');

  played[0].opt.onFail();
  assert.equal(media.pauseCalls, 1);
  assert.equal(media.loop, false);
  assert.equal(web.length, 1, 'fallback starts immediately instead of waiting one interval');
  assert.equal(web[0].opt.sustain, true);
  assert.equal(timers[0].ms, 1160, '1.2 second fallback tones overlap by 40 ms');
  timers[0].fn();
  assert.equal(web.length, 2);
  assert.deepEqual(Array.from(vibrations[0]), [400, 200, 400, 200, 400]);
});

test('incoming ringtone does not force the fallback when sound is disabled', () => {
  let intervals = 0;
  const ctx = vm.createContext({
    S: { settings: { sound: false } },
    navigator: { vibrate() {} },
    playMediaTone() { return null; },
    webToneSequence() { throw new Error('sound-off fallback must not start'); },
    setInterval() { intervals++; return 1; },
  });
  vm.runInContext(`let _ring=null;function ringStop(){_ring=null;}${functionSource('ringStart')};globalThis.start=ringStart;`, ctx);
  ctx.start();
  assert.equal(intervals, 0);
});

test('WebAudio continuity option holds the gain until the final fade', () => {
  const gainCalls = [];
  const audio = {
    currentTime: 10,
    destination: {},
    createOscillator() { return { frequency: {}, connect() {}, start() {}, stop() {} }; },
    createGain() {
      return { connect() {}, gain: {
        setValueAtTime(value, at) { gainCalls.push(['set', value, at]); },
        exponentialRampToValueAtTime(value, at) { gainCalls.push(['ramp', value, at]); },
      } };
    },
  };
  const ctx = vm.createContext({ _audio: audio, ensureAudio() {}, volMul: () => 1 });
  vm.runInContext(`${functionSource('webToneSequence')};globalThis.run=webToneSequence;`, ctx);
  assert.equal(ctx.run([[880, 1.2]], { level: 0.055, sustain: true }), true);
  assert.deepEqual(gainCalls, [
    ['set', 0.0001, 10],
    ['ramp', 0.055, 10.01],
    ['set', 0.055, 11.16],
    ['ramp', 0.0001, 11.2],
  ]);
});
