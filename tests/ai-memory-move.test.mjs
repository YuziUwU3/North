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
vm.runInContext(source.slice(start,end)+'\nthis.__json=aiMemoryJsonStrings;this.__split=aiMemorySplitParts;this.__ext=aiMemoryFileExt;this.__docx=aiMemoryDocxText;this.__zip=aiMemoryZipEntries;',sandbox);

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

function storedDocxNamed(path,text,flags=0){
  const name=Buffer.from(path),data=Buffer.from(text),local=Buffer.alloc(30),central=Buffer.alloc(46),end=Buffer.alloc(22);
  local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(flags,6);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(name.length,26);
  const localBlock=Buffer.concat([local,name,data]),centralOffset=localBlock.length;
  central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(flags,8);central.writeUInt32LE(data.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(name.length,28);central.writeUInt32LE(0,42);
  const centralBlock=Buffer.concat([central,name]);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(centralBlock.length,12);end.writeUInt32LE(centralOffset,16);
  return Buffer.concat([localBlock,centralBlock,end]);
}
function asFile(buffer){return{arrayBuffer:async()=>buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength)};}
const oddPath=storedDocxNamed('/word\\document2.xml','<w:document xmlns:w="x"><w:body><w:p><w:r><w:t>非标准路径记忆</w:t></w:r></w:p></w:body></w:document>');
assert.match(await sandbox.__docx(asFile(oddPath)),/非标准路径记忆/);
const arbitraryPath=storedDocxNamed('custom/mainBody.xml','<w:document xmlns:w="x"><w:body><w:p><w:r><w:t>第三方导出正文</w:t></w:r></w:p></w:body></w:document>');
assert.match(await sandbox.__docx(asFile(arbitraryPath)),/第三方导出正文/);
const encrypted=storedDocxNamed('word/document.xml','secret',1);
await assert.rejects(()=>sandbox.__docx(asFile(encrypted)),/已加密/);
const ole=Buffer.from([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1]);
await assert.rejects(()=>sandbox.__docx(asFile(ole)),/旧版或加密/);
const imageOnly=storedDocxNamed('word/document.xml','<w:document xmlns:w="x"><w:body><w:p><w:drawing/></w:p></w:body></w:document>');
await assert.rejects(()=>sandbox.__docx(asFile(imageOnly)),/没有可复制的文字/);

function zip64Docx(text){
  const name=Buffer.from('word/document.xml'),data=Buffer.from(`<w:document xmlns:w="x"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`),local=Buffer.alloc(30),central=Buffer.alloc(46),extra=Buffer.alloc(28);
  local.writeUInt32LE(0x04034b50,0);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(name.length,26);
  const localBlock=Buffer.concat([local,name,data]),centralOffset=localBlock.length;
  central.writeUInt32LE(0x02014b50,0);central.writeUInt32LE(0xffffffff,20);central.writeUInt32LE(0xffffffff,24);central.writeUInt16LE(name.length,28);central.writeUInt16LE(extra.length,30);central.writeUInt32LE(0xffffffff,42);
  extra.writeUInt16LE(1,0);extra.writeUInt16LE(24,2);extra.writeBigUInt64LE(BigInt(data.length),4);extra.writeBigUInt64LE(BigInt(data.length),12);extra.writeBigUInt64LE(0n,20);
  const centralBlock=Buffer.concat([central,name,extra]),z64=Buffer.alloc(56),locator=Buffer.alloc(20),end64=Buffer.alloc(22),z64Offset=centralOffset+centralBlock.length;
  z64.writeUInt32LE(0x06064b50,0);z64.writeBigUInt64LE(44n,4);z64.writeBigUInt64LE(1n,24);z64.writeBigUInt64LE(1n,32);z64.writeBigUInt64LE(BigInt(centralBlock.length),40);z64.writeBigUInt64LE(BigInt(centralOffset),48);
  locator.writeUInt32LE(0x07064b50,0);locator.writeBigUInt64LE(BigInt(z64Offset),8);locator.writeUInt32LE(1,16);
  end64.writeUInt32LE(0x06054b50,0);end64.writeUInt16LE(0xffff,8);end64.writeUInt16LE(0xffff,10);end64.writeUInt32LE(0xffffffff,12);end64.writeUInt32LE(0xffffffff,16);
  return Buffer.concat([localBlock,centralBlock,z64,locator,end64]);
}
assert.match(await sandbox.__docx(asFile(zip64Docx('ZIP64 大文件记忆'))),/ZIP64 大文件记忆/);

assert.match(source,/me:_MI\('<circle cx="12" cy="12" r="8\.4"\/>/,'home dock Me icon should use the same round smile face as WeChat');

console.log('ai memory move tests passed');
