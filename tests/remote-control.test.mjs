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

test('remote control is exposed only through the bound couple space', () => {
  assert.match(app, /function remoteControlAllowed\(cid\)/);
  assert.match(app, /S\.couple&&S\.couple\.cid===cid/);
  assert.match(app, /!remoteControlAllowed\(cid\)/);
  assert.match(app, /id="cou_remote"/);
  assert.match(app, /允许 \$\{nm\} 发起远程操控申请/);
  assert.match(app, /每一次都会先弹出【同意 \/ 拒绝】/);
  assert.match(app, /不是苹果系统里的其他真实 App/);
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

test('every action has slow silent subtitles and persistent memory', () => {
  const remote = app.match(/let _remoteCtl[\s\S]*?(?=\/\/ ===== 他登录我的微信)/)?.[0] || '';
  assert.match(app, /function remoteControlCaptionMs\(t\)\{return Math\.max\(4600/);
  assert.doesNotMatch(remote, /SpeechSynthesisUtterance|speechSynthesis|remoteControlSpeak/);
  assert.match(app, /function remoteControlCaption\(say\)/);
  assert.match(app, /cap\.replaceChildren\(b\)/);
  assert.match(html, /\.remote-caption-bubble/);
  assert.match(html, /\.remote-caption-wrap\{[^}]*bottom:max\(20px,env\(safe-area-inset-bottom\)\)/);
  assert.match(html, /@keyframes remoteCaptionUp/);
  assert.match(app, /remoteControlRemember\(c,\{ts:Date\.now\(\),startedAt/);
  assert.match(app, /function remoteControlHistoryPrompt\(c\)/);
  assert.match(app, /'remoteControlHistory'/);
});

test('role opens the real small-phone pages and searches the current desktop layout', () => {
  assert.doesNotMatch(html, /class="remote-device"/);
  assert.match(html, /\.remote-control-layer\{[^}]*background:transparent/);
  assert.match(app, /function remoteControlSetPage\(p,params\)/);
  assert.match(app, /function remoteControlNavigate\(a,r\)/);
  assert.match(app, /function remoteControlDesktopPage\(key\)/);
  assert.match(app, /S\.me\.appLayout\[i\]\.indexOf\(key\)/);
  assert.match(app, /sw\.scrollTo\(\{left:sw\.clientWidth\*pg,behavior:'smooth'\}\)/);
  assert.match(app, /document\.querySelector\('\.app\[data-k="'\+key\+'"\]'\)/);
  assert.match(app, /await remoteControlOpenApp\(a,c\)/);
});

test('X and Weibo posting, deletion and likes are part of the control plan', () => {
  assert.match(app, /post_x/);
  assert.match(app, /delete_x/);
  assert.match(app, /toggle_x_like/);
  assert.match(app, /推特\|微博\|X/);
  assert.match(app, /x:'X \/ 微博'/);
  assert.match(app, /发布微博 \/ X/);
  assert.match(app, /delete_x_dm/);
  assert.match(app, /delete_douyin_dm/);
});
