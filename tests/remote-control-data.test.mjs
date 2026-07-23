import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const app = readFileSync(join(root, 'app.js'), 'utf8');

test('remote viewing reuses real order, travel, and phone records', () => {
  assert.match(app, /function remoteControlPhoneSnapshot\(\)/);
  assert.match(app, /p\.recents\|\|\[\]/);
  assert.match(app, /Object\.keys\(p\.sms\|\|\{\}\)/);
  assert.match(app, /p\.voicemail\|\|\[\]/);
  assert.match(app, /function foodOrderRows\(\)/);
  assert.match(app, /S\.shop&&S\.shop\.orders/);
  assert.match(app, /S\.travel&&S\.travel\.trips/);
  assert.match(app, /phoneCalls:pc\.calls,phoneSms:pc\.sms,phoneVoicemail:pc\.voicemail/);
});

test('remote viewing opens the matching real app and remembers only viewed facts', () => {
  assert.match(app, /function remoteControlViewFact\(a,c\)/);
  assert.match(app, /实际看到/);
  assert.match(app, /function remoteControlPlanningSnapshot\(c\)/);
  assert.match(app, /inv\[k\]=Array\.isArray\(x\)\?\{count:x\.length\}/);
  assert.match(app, /必须实际执行对应view后/);
  assert.match(app, /if\(app==='travel'\)\{tvInit\(\);_tvTab='trips'/);
  assert.match(app, /if\(app==='shop'\)\{remoteControlSetPage\('shop'\)/);
  assert.match(app, /openOrders\(\)/);
  assert.match(app, /if\(app==='food'\)\{remoteControlSetPage\('food'\)/);
  assert.match(app, /openFoodOrders\(\)/);
  assert.match(app, /if\(app==='phoneapp'\)\{const p=phState\(\);p\.tab=/);
  assert.match(app, /travel:'travel'/);
});
