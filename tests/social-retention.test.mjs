import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=source.indexOf('function cleanupOld()');
const end=source.indexOf('setInterval(cleanupOld',start);
assert.ok(start>=0&&end>start);
const cleanup=source.slice(start,end);

test('social posts remain retained and keep their explicit delete controls',()=>{
  assert.doesNotMatch(cleanup,/S\.moments\s*=\s*S\.moments\.filter/,'moments must not expire after 24 hours');
  assert.doesNotMatch(cleanup,/S\.x\.tweets\s*=\s*S\.x\.tweets\.filter/,'tweets must not expire after 24 hours');
  assert.match(source,/\$\{fmtDT\(p\.time\)\}/,'moments must show full year-month-day time');
  assert.match(source,/aria-label="删除朋友圈"[\s\S]*?svgIc\('trash',14/);
  assert.match(source,/aria-label="删除朋友圈"[\s\S]*?svgIc\('trash',15/);
  assert.match(source,/aria-label="删除推文"[\s\S]*?svgIc\('trash',14/);
  const deletion=source.slice(source.indexOf('async function momentDelete(pid)'),source.indexOf('function momentMenu(',source.indexOf('async function momentDelete(pid)')));
  assert.match(deletion,/S\.moments\.some\(x=>x&&x\.id===pid\)/);
  assert.doesNotMatch(deletion,/authorId===['"]me['"]/,'role moments must remain deletable');
});

test('moment likes and comments are inline, reversible, and preserve the current scroll position',()=>{
  assert.match(source,/function momentRenderKeepScroll\(/);
  assert.match(source,/const restore=\(\)=>\{const after=momentScrollElement\(\);if\(after\)after\.scrollTop=top/);
  assert.match(source,/requestAnimationFrame\(\(\)=>\{restore\(\);requestAnimationFrame\(restore\);\}\)/);
  assert.match(source,/function toggleMomentLike\(pid\)/);
  assert.match(source,/splice\(i,1\)/);
  assert.match(source,/push\(S\.me\.name\)/);
  assert.match(source,/function momentCommentFocus\(pid,replyName,targetCid\)/);
  assert.match(source,/function momentCommentSubmit\(pid,inputId\)/);
  assert.match(source,/class="moment-action-popover"/);
  assert.match(source,/class="moment-inline-compose"/);
  assert.doesNotMatch(source,/openModal\(`<h3>互动<\/h3>/);
});

test('role replies to moment comments use the exact thread and recent WeChat context without fake fallback text',()=>{
  const begin=source.indexOf('async function reactToComment(');
  const end=source.indexOf('function ',begin+20);
  const block=source.slice(begin,end);
  assert.match(block,/msgs\(c\.id\)\.slice\(-12\)/);
  assert.match(block,/buildSystem\(c\)/);
  assert.match(block,/targetComment/);
  assert.match(block,/attempt<2/);
  assert.match(block,/momentReplySpecific/);
  assert.match(source,/function momentReplySpecific\(txt\)[^\n]*看到了\|我看到了\|收到/);
  assert.match(block,/不要泛泛说“看到了”“收到”“等我”/);
  assert.doesNotMatch(source,/function momentReplyFallback\(/);
});
