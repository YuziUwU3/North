import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

test('ordinary product mentions cannot become the relationship collar title',()=>{
  assert.match(app,/function collarRelationshipTitle\(text\)/);
  assert.match(app,/Tiffany\|项圈\|粉钻\|钻石\|定制\|材质\|款式\|价格\|项链\|饰品/);
  assert.match(app,/repairedFrom:String\(cl\.text\)/);
  assert.match(app,/text:'先生的小宝贝'/);
});

test('collar command tags and natural-language fallback both require an explicit role action',()=>{
  assert.match(app,/\(\?:挂\|换\|改\|戴\|套\|加\|上\)项圈/);
  assert.match(app,/\(\?:摘\|取\|解\|去\|卸\|拿\|下\)项圈/);
  const begin=app.indexOf('async function maybeCollarIntent(');
  const end=app.indexOf('const APP_NLWORDS=',begin);
  const block=app.slice(begin,end);
  assert.match(block,/explicitSet=/);
  assert.match(block,/explicitRemove=/);
  assert.match(block,/if\(!explicitSet&&!explicitRemove\)return/);
  assert.match(block,/collarRelationshipTitle\(d\.set\)/);
});
