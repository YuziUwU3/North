import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const edge=fs.readFileSync(new URL('../supabase/functions/phone-ai/index.ts',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../supabase/migrations/202607280001_asr_long_discount.sql',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');

function functionSource(source,name){
  const start=source.indexOf(`function ${name}`);
  assert.ok(start>=0,`missing ${name}`);
  const brace=source.indexOf('{',start);
  let depth=0;
  for(let i=brace;i<source.length;i++){
    if(source[i]==='{')depth++;
    else if(source[i]==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

test('long MP4 extraction is progressive and resumable',()=>{
  const main=functionSource(app,'cinemaExtractAudioSubtitles');
  assert.doesNotMatch(main,/\.arrayBuffer\(\),audio=await ac\.decodeAudioData/);
  assert.match(app,/MP4Box\.createFile\(false\)/);
  assert.match(app,/mp4\.discardMdatData=false/);
  assert.match(app,/file\.slice\(offset,end\)\.arrayBuffer\(\)/);
  assert.match(app,/sizePerSegment:6\*1024\*1024/);
  assert.match(app,/cinemaMp4ResetBaseTime/);
  assert.match(app,/cinemaAsrSaveJob/);
  assert.match(app,/下次可继续/);
});

test('long-video estimates keep the conservative discount ceiling',()=>{
  const context={sttRelaySecondsPerPoint:()=>15,Math,Number};
  vm.runInNewContext(functionSource(app,'cinemaAsrDiscountPct')+'\n'+functionSource(app,'cinemaAsrEstimate'),context);
  assert.deepEqual({...context.cinemaAsrEstimate(1800)},{base:120,pct:5,discount:6,net:114});
  assert.deepEqual({...context.cinemaAsrEstimate(3600)},{base:240,pct:8,discount:19,net:221});
  assert.deepEqual({...context.cinemaAsrEstimate(7200)},{base:480,pct:10,discount:48,net:432});
  assert.equal(context.cinemaAsrDiscountPct(20000),10);
});

test('standalone M4A fragments reset their media clock to zero',()=>{
  const bytes=new Uint8Array(32),view=new DataView(bytes.buffer);
  const box=(offset,size,type)=>{view.setUint32(offset,size);for(let i=0;i<4;i++)bytes[offset+4+i]=type.charCodeAt(i);};
  box(0,32,'moof');box(8,24,'traf');box(16,16,'tfdt');bytes[24]=0;view.setUint32(28,123456);
  const context={DataView,Uint8Array,String,Number};
  vm.runInNewContext(functionSource(app,'cinemaMp4ForEachBox')+'\n'+functionSource(app,'cinemaMp4ResetBaseTime'),context);
  const reset=new DataView(context.cinemaMp4ResetBaseTime(bytes.buffer));
  assert.equal(reset.getUint32(28),0);
});

test('discount is computed from successful server ledger rows only',()=>{
  assert.match(edge,/action === "asr_discount"/);
  assert.match(edge,/job_id: jobId/);
  assert.match(edge,/duration_seconds: duration/);
  assert.match(edge,/outer\?\.output \|\| outer/);
  assert.match(migration,/feature = 'asr'[\s\S]*status = 'done'/);
  assert.match(migration,/meta->>'purpose' = 'cinema_subtitles'/);
  assert.match(migration,/v_duration >= 7200 then v_rate := 10/);
  assert.match(migration,/greatest\(0, v_target - v_already_refunded\)/);
  assert.match(migration,/revoke all on function public\.phone_ai_asr_long_discount/);
});

test('vendored MP4 parser is available offline',async()=>{
  const MP4Box=await import('../vendor/mp4box.all.mjs');
  assert.equal(typeof MP4Box.createFile,'function');
  assert.match(sw,/vendor\/mp4box\.all\.mjs/);
  assert.match(sw,/\/vendor\\\/\//);
  assert.ok(fs.statSync(new URL('../vendor/MP4BOX-LICENSE.txt',import.meta.url)).size>1000);
});
