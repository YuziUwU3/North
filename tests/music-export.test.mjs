import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
function functionSource(name){
  const fnStart=source.indexOf('function '+name+'(');
  assert.ok(fnStart>=0,'missing '+name);
  const start=source.slice(Math.max(0,fnStart-6),fnStart)==='async '?fnStart-6:fnStart;
  let brace=source.indexOf('{',start),depth=0,quote='',escaped=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error('unterminated '+name);
}

assert.match(source,/MUSIC_EXPORT_PACK_SAFE_BYTES=20\*1024\*1024,MUSIC_EXPORT_ONE_SAFE_BYTES=32\*1024\*1024/);
assert.match(functionSource('musicExportPack'),/if\(_musicExportBusy\)/);
assert.match(functionSource('musicExportPack'),/musicExportMeasure\(songs,false\)[\s\S]*MUSIC_EXPORT_PACK_SAFE_BYTES[\s\S]*musicExportOneModal/);
assert.match(functionSource('musicExportOne'),/musicExportMeasure\(\[s\],true\)[\s\S]*MUSIC_EXPORT_ONE_SAFE_BYTES/);
assert.doesNotMatch(functionSource('musicExportPack'),/new Blob\(\[JSON\.stringify\(pack\)\]/);
assert.doesNotMatch(functionSource('musicExportOne'),/new Blob\(\[JSON\.stringify\(pack\)\]/);
assert.match(functionSource('musicPrepareReadyExport'),/onclick="musicSaveReadyExport\(\)"/);
assert.match(functionSource('musicSaveReadyExport'),/beautySaveFile\(ready\.blob,ready\.name\)/);

const ctx=vm.createContext({
  S:{music:{loop:true,totalSec:12,distance:8,meAvatar:'me',taAvatar:'ta',bg:'bg'}},
  Blob,Map,Date,
  musicExportDataURLSafe(){return true;},
  async mGet(){throw new Error('preloaded blob should be reused');},
  async mBlobDataURL(){return 'data:audio/mpeg;base64,QUJD';},
});
for(const name of ['musicPackSettings','musicPackBlob'])vm.runInContext('this.'+name+'='+functionSource(name),ctx);
const songs=[{id:'local',title:'本地歌',src:{t:'idb'}},{id:'remote',title:'直链歌',src:{t:'url',url:'https://example.com/a.mp3'}}];
const blob=await ctx.musicPackBlob(songs,false,new Map([['local',new Blob(['ABC'],{type:'audio/mpeg'})]]));
const parsed=JSON.parse(await blob.text());
assert.equal(parsed.type,'yibei-music-pack');
assert.equal(parsed.ver,1);
assert.equal(parsed.music.songs.length,2);
assert.equal(parsed.music.songs[0].file,'data:audio/mpeg;base64,QUJD');
assert.equal(parsed.music.songs[1].src.url,'https://example.com/a.mp3');
assert.equal(parsed.music.loop,true);
assert.equal(parsed.music.bg,'bg');

let encoded=0,routed='';
const limitCtx=vm.createContext({
  S:{music:{songs:[{id:'large'}]}},
  musicInit(){},toast(){},cacheSizeText(n){return String(n);},
  async musicExportMeasure(){return{bytes:20*1024*1024+1,blobs:new Map()};},
  musicExportOneModal(reason){routed=reason;},
  async musicPackBlob(){encoded++;},musicPrepareReadyExport(){},Map,Date,
});
vm.runInContext('const MUSIC_EXPORT_PACK_SAFE_BYTES=20*1024*1024;let _musicExportBusy=false;this.musicExportPack='+functionSource('musicExportPack'),limitCtx);
await limitCtx.musicExportPack();
assert.equal(encoded,0,'oversized packs must stop before Base64 encoding');
assert.match(routed,/分首导出/);

console.log('music export safety tests passed');
