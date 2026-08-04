import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=source.indexOf('function cleanupOld()');
const end=source.indexOf('setInterval(cleanupOld',start);
assert.ok(start>=0&&end>start);
const cleanup=source.slice(start,end);

assert.doesNotMatch(cleanup,/S\.moments\s*=\s*S\.moments\.filter/,'moments must not expire after 24 hours');
assert.doesNotMatch(cleanup,/S\.x\.tweets\s*=\s*S\.x\.tweets\.filter/,'tweets must not expire after 24 hours');
assert.match(source,/\$\{fmtDT\(p\.time\)\}/,'moments must show full year-month-day time');
assert.match(source,/aria-label="删除朋友圈"[\s\S]*?svgIc\('trash',14/);
assert.match(source,/aria-label="删除推文"[\s\S]*?svgIc\('trash',14/);
assert.match(source,/async function momentDelete\(pid\)/);
assert.match(source,/async function xDeleteTweet\(id\)/);

console.log('social retention tests passed');
