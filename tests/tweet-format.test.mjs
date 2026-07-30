import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
function fn(name){const start=source.indexOf(`function ${name}`);assert.ok(start>=0,`missing ${name}`);const brace=source.indexOf('{',start);let depth=0,quote='',escaped=false;for(let i=brace;i<source.length;i++){const ch=source[i];if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return source.slice(start,i+1);}throw new Error(`unterminated ${name}`);}

const context=vm.createContext({cleanRolePunct:x=>String(x),CTLLEAK:/^\[\s*发推[|｜:：\]]/});
vm.runInContext(source.slice(source.indexOf('function cleanTweetBody'),source.indexOf('function repairTweetTexts')),context);

test('tweet command tags never leak or duplicate the visible body',()=>{
  assert.equal(context.cleanTweetText('凌晨五点的机场候机厅。\n\n[发推|凌晨五点的机场候机厅。]'),'凌晨五点的机场候机厅。');
  assert.equal(context.cleanTweetText('推文：今天回家。\n今天回家。'),'今天回家。');
  assert.doesNotMatch(context.cleanTweetText('[发推|只显示这一句]'),/发推|\[|【/);
});

test('all role and remote publishing paths clean tweet text',()=>{
  assert.match(fn('publishRoleTweet'),/text=cleanTweetText\(text\)/);
  assert.match(fn('remoteControlExecute'),/a\.op==='post_x'[\s\S]*?tx=cleanTweetText\(a\.content\)/);
  assert.match(fn('openX'),/repairTweetTexts\(\)/);
});
