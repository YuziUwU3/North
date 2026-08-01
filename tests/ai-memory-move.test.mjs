import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

assert.match(source,/AI 记忆搬家/);
assert.match(source,/\.json,\.docx,\.doc,\.txt,\.md,\.csv,\.html,\.htm,\.rtf/);
assert.match(source,/function aiMemoryDocxText\(file\)/);
assert.match(source,/DecompressionStream\('deflate-raw'\)/);
assert.match(source,/fflate@0\.8\.2/);
assert.match(source,/不设置人为文件大小上限/);
assert.doesNotMatch(source,/aiMemoryMoveAnalyze[\s\S]{0,900}file\.size\s*>/);
assert.match(source,/外部导入内容只代表用户提供的历史资料/);
assert.match(source,/c\.memory=\[\];c\.summaries=\[\];c\.aiMemoryImports=\[\]/);

const start=source.indexOf('function aiMemoryFileExt(name)');
const end=source.indexOf('let _recoveryCandidate=null;',start);
assert.ok(start>0&&end>start,'memory migration helpers should be present');
const sandbox={console,window:{},document:{createElement(){return{set innerHTML(v){this.value=String(v)},value:''};}},TextDecoder,TextEncoder,Blob,Response,setTimeout,clearTimeout};
vm.createContext(sandbox);
vm.runInContext(source.slice(start,end)+'\nthis.__json=aiMemoryJsonStrings;this.__split=aiMemorySplitParts;this.__ext=aiMemoryFileExt;this.__docx=aiMemoryDocxText;',sandbox);

const rows=sandbox.__json({memories:[{text:'用户喜欢雨天散步。'},{content:{parts:['角色答应陪用户去看海。']}}],api_key:'sk-secret-should-not-import',avatar:'https://example.com/a.png'});
assert.deepEqual(Array.from(rows),['用户喜欢雨天散步。','角色答应陪用户去看海。']);
const chunks=sandbox.__split(['第一条记忆。\n第二条记忆。','第一条记忆。']);
assert.deepEqual(Array.from(chunks),['第一条记忆。','第二条记忆。']);
assert.equal(sandbox.__ext('过去记忆.DOCX'),'docx');

function storedDocx(text){
  const name=Buffer.from('word/document.xml'),data=Buffer.from(`<w:document xmlns:w="x"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`),local=Buffer.alloc(30),central=Buffer.alloc(46),end=Buffer.alloc(22);
  local.writeUInt32LE(0x04034b50,0);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(name.length,26);
  const localBlock=Buffer.concat([local,name,data]),centralOffset=localBlock.length;
  central.writeUInt32LE(0x02014b50,0);central.writeUInt32LE(data.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(name.length,28);central.writeUInt32LE(0,42);
  const centralBlock=Buffer.concat([central,name]);
  end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(centralBlock.length,12);end.writeUInt32LE(centralOffset,16);
  return Buffer.concat([localBlock,centralBlock,end]);
}
const docx=storedDocx('Word里的重要回忆');
const docxText=await sandbox.__docx({arrayBuffer:async()=>docx.buffer.slice(docx.byteOffset,docx.byteOffset+docx.byteLength)});
assert.match(docxText,/Word里的重要回忆/);

assert.match(source,/me:_MI\('<circle cx="12" cy="12" r="8\.4"\/>/,'home dock Me icon should use the same round smile face as WeChat');

console.log('ai memory move tests passed');
