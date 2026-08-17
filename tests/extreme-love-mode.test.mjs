import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

assert.match(source,/function extremeLoveOn\(\)\{return false;\}/,'extreme attachment must be permanently inactive');
assert.match(source,/delete S\.couple\.extremeLove/,'legacy saved mode must be removed during migration');
assert.doesNotMatch(source,/id="cou_extreme"/,'the retired mode must not remain in couple settings');
assert.doesNotMatch(source,/onclick="coupleExtremeLove\(\)"/,'the retired mode must have no visible entry point');
assert.match(source,/# 角色内心想法（仅展示，不控制角色）/,'inner thought display remains available');
assert.match(source,/不是心情值，不改变任何数值、亲密度、行为权限或自主决定/);
assert.match(source,/function roleCapabilityPrompt\(\)/,'autonomous capabilities remain available after removing the mode');
assert.match(source,/· 打语音或视频电话/);
assert.match(source,/· 送礼物或准备惊喜/);

console.log('retired extreme attachment mode tests passed');
