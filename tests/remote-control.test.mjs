import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const app = readFileSync(join(root, 'app.js'), 'utf8');
const html = readFileSync(join(root, '小手机.html'), 'utf8');

test('remote control always requires an explicit request and user choice', () => {
  assert.match(app, /\[申请远程操控\]/);
  assert.match(app, /function remoteControlRequest\(cid\)/);
  assert.match(app, /remoteControlDeny\('\$\{c\.id\}'\)/);
  assert.match(app, /remoteControlApprove\('\$\{c\.id\}'\)/);
  assert.match(app, /拒绝后不会获得任何内容/);
});

test('refusal never starts a session and produces a personality reaction', () => {
  const deny = app.match(/function remoteControlDeny\(cid\)[\s\S]*?(?=\nfunction remoteControlApprove\(cid\))/)?.[0] || '';
  assert.doesNotMatch(deny, /remoteControlSnapshot|remoteControlRun/);
  assert.match(deny, /status:'denied'/);
  assert.match(deny, /scheduleReply\(cid/);
  assert.match(deny, /绝对不能假装看到了/);
});

test('remote operations are allowlisted and destructive actions verify ownership', () => {
  assert.match(app, /REMOTE_ALLOWED_OPS=new Set\(\[/);
  for (const op of ['send_wechat', 'post_moment', 'delete_moment', 'post_x', 'delete_x', 'delete_douyin', 'lock_app']) {
    assert.match(app, new RegExp(`'${op}'`));
  }
  assert.match(app, /a\.op==='delete_moment'[\s\S]*?t\.authorId!=='me'/);
  assert.match(app, /a\.op==='delete_x'[\s\S]*?t\.who!=='me'/);
  assert.match(app, /a\.op==='delete_douyin'[\s\S]*?t\.cid!=='me'/);
  assert.doesNotMatch(app, /eval\s*\(|new Function\s*\(/);
});

test('live overlay blocks the phone while preserving an emergency stop', () => {
  assert.match(html, /id="remoteControlLayer"/);
  assert.match(html, /id="remoteRoleName"/);
  assert.match(html, /id="remoteCaption"/);
  assert.match(html, /onclick="remoteControlStopByUser\(\)"/);
  assert.match(html, /\.remote-control-layer\{position:absolute;inset:0;z-index:550/);
  assert.match(html, /\.remote-live-dot\{[^}]*background:#ff2942/);
});

test('every action has slow subtitles, free device speech, and persistent memory', () => {
  assert.match(app, /function remoteControlCaptionMs\(t\)\{return Math\.max\(3300/);
  assert.match(app, /SpeechSynthesisUtterance/);
  assert.match(app, /remoteControlRemember\(c,\{ts:Date\.now\(\),startedAt/);
  assert.match(app, /function remoteControlHistoryPrompt\(c\)/);
  assert.match(app, /'remoteControlHistory'/);
});

test('X and Weibo posting, deletion and likes are part of the control plan', () => {
  assert.match(app, /post_x/);
  assert.match(app, /delete_x/);
  assert.match(app, /toggle_x_like/);
  assert.match(app, /推特\|微博\|X/);
  assert.match(app, /x:'X \/ 微博'/);
  assert.match(app, /发布微博 \/ X/);
});
