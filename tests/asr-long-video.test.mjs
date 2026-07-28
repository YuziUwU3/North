import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const edge=fs.readFileSync(new URL('../supabase/functions/phone-ai/index.ts',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../supabase/migrations/202607280001_asr_long_discount.sql',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');

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
  const main=functionSource(app,'cinemaExtractAudioSubtitlesProgressive');
  assert.doesNotMatch(main,/\.arrayBuffer\(\),audio=await ac\.decodeAudioData/);
  assert.match(app,/MP4Box\.createFile\(false\)/);
  assert.match(app,/MP4Box\.createFile\(true\)/);
  assert.match(app,/file\.slice\(offset,end\)\.arrayBuffer\(\)/);
  assert.match(app,/sizePerSegment:6\*1024\*1024/);
  assert.match(app,/cinemaMp4ResetBaseTime/);
  assert.match(app,/cinemaAsrSaveJob/);
  assert.match(app,/下次可继续/);
  assert.match(main,/cinemaAwaitAsr/);
  assert.match(main,/正在准备音轨/);
  assert.match(main,/全片提取完成/);
  assert.match(app,/cinemaExtractAudioSubtitles=cinemaExtractAudioSubtitlesProgressive/);
  assert.match(main,/mode==='background'&&v\)v\.pause\(\)/);
  assert.match(main,/mode==='watch'&&v&&v\.paused\)v\.play\(\)/);
  assert.match(main,/字幕已同步到/);
  assert.match(app,/cinemaExtractAudioSubtitles\(90,'watch'\)/);
  assert.match(app,/cinemaExtractAudioSubtitles\(90,'background'\)/);
});

test('completed chunks persist, resume without billing, and expose a home-page task ball',()=>{
  const main=functionSource(app,'cinemaExtractAudioSubtitlesProgressive');
  const save=functionSource(app,'cinemaAsrSaveJob');
  assert.ok(main.indexOf('const key=String(seg.index),old=job.parts&&job.parts[key]')<main.indexOf('request=sttRequest'), 'saved chunks must be skipped before any paid request');
  assert.match(main,/requestId=\(job\.jobId\+'_chunk_'\+seg\.index\)/);
  assert.match(main,/本次没有扣点/);
  assert.match(save,/await cinPut\(cinemaAsrJobKey\(s\),job\)/);
  assert.match(save,/navigator\.storage\.persist/);
  assert.match(app,/function cinemaAsrTasksHTML/);
  assert.match(app,/主页面可随时查看/);
  assert.match(app,/waitText/);
  assert.match(html,/\.cin-asr-task>i/);
});

test('removing a video also removes its subtitle cache and task',()=>{
  const remove=functionSource(app,'cinemaLibraryDelete');
  const clear=functionSource(app,'cinemaDeleteStoredSubtitles');
  const save=functionSource(app,'cinemaAsrSaveJob');
  assert.match(remove,/cinemaDeleteStoredSubtitles\(item\.mediaKey\)/);
  assert.match(remove,/Promise\.all\(\[cinDel\(contentKey\),subtitleDelete\]\)/);
  assert.match(remove,/视频和字幕已删除/);
  assert.match(clear,/delete x\.asrTasks\[taskKey\]/);
  assert.match(clear,/await cinDel\(jobKey\)/);
  assert.match(clear,/_cin\.token\+\+/);
  assert.match(clear,/_cin\.cues=_cin\.cues\.filter/);
  assert.match(save,/if\(!exists\(\)\)return null/);
  assert.match(save,/if\(!exists\(\)\)\{await cinDel\(cinemaAsrJobKey\(s\)\)/);
});

test('one video can expose only one subtitle extraction task',()=>{
  const context={
    cinemaInit:()=>({asrTasks:{
      old:{id:'old',mediaKey:'same-video',updatedAt:1},
      newest:{id:'newest',mediaKey:'same-video',updatedAt:2},
      other:{id:'other',mediaKey:'other-video',updatedAt:3},
    }}),
    Object,Set,
  };
  vm.runInNewContext(functionSource(app,'cinemaAsrTaskRows'),context);
  assert.deepEqual(context.cinemaAsrTaskRows().map(x=>x.id),['other','newest']);
  const update=functionSource(app,'cinemaAsrTaskUpdate');
  assert.match(update,/cinemaStoreKey\('asr-task',s\.mediaKey\)/);
  assert.match(update,/x\.asrTasks\[k\]\.mediaKey===s\.mediaKey/);
  assert.match(update,/delete x\.asrTasks\[k\]/);
  assert.match(functionSource(app,'cinemaExtractAudioSubtitlesProgressive'),/if\(_cin\.extracting\)return toast/);
});

test('playback waits before it can outrun the extracted subtitle frontier',()=>{
  const context={
    _cin:{extracting:true,asrMode:'watch',asrCoveredUntil:0,asrGuardPaused:false},
    cinemaFmt:()=> '0:20',
    cinemaSetStatus:()=>{},
    Math,Number,
  };
  vm.runInNewContext(functionSource(app,'cinemaAsrGuardPlayback'),context);
  let pauses=0;
  const video={currentTime:25,paused:false,pause(){this.paused=true;pauses++;}};
  assert.equal(context.cinemaAsrGuardPlayback(video),true);
  assert.equal(video.currentTime,20);
  assert.equal(pauses,1);
  assert.equal(context._cin.asrGuardPaused,true);
  assert.match(functionSource(app,'cinemaVideoTick'),/cinemaAsrGuardPlayback\(v\)/);
  assert.match(functionSource(app,'cinemaAfterVideoRender'),/seeked[\s\S]*cinemaAsrGuardPlayback\(v\)/);
});

test('contiguous coverage rejects a missing middle segment',()=>{
  const context={Object,Number,Math};
  vm.runInNewContext(functionSource(app,'cinemaAsrContiguousSeconds'),context);
  assert.equal(context.cinemaAsrContiguousSeconds({duration:270,parts:{0:{start:0,end:90},2:{start:180,end:270}}}),90);
  assert.equal(context.cinemaAsrContiguousSeconds({duration:270,parts:{0:{start:0,end:90},1:{start:90,end:180},2:{start:180,end:270}}}),270);
});

test('vision status temporarily owns the shared progress chip',()=>{
  const status=functionSource(app,'cinemaSetStatus');
  const vision=functionSource(app,'cinemaAnalyzeFrame');
  assert.match(status,/_cin\.visionBusy/);
  assert.match(status,/_cin\.statusDeferred/);
  assert.match(vision,/正在识别当前画面…','working','vision'/);
  assert.match(vision,/画面识别完成','ready','vision'/);
  assert.match(vision,/cinemaResumeDeferredStatus/);
  assert.match(html,/\.cin-status-chip[^\n]*top:max\(124px/);
});

test('metadata probing stops once MP4 track information is ready',()=>{
  const prepare=functionSource(app,'cinemaMp4Prepare');
  const run=functionSource(app,'cinemaMp4RunSegments');
  assert.match(prepare,/if\(info\)break/);
  assert.match(prepare,/onProgress/);
  assert.doesNotMatch(prepare,/return\{mp4,queue/);
  assert.match(run,/MP4Box\.createFile\(true\)/);
  assert.match(run,/onReadProgress/);
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

test('server returns a cached successful chunk for the stable request id',()=>{
  assert.match(edge,/async function cachedAsrResult/);
  assert.match(edge,/cached\.status === "done" && cached\.data/);
  assert.match(edge,/charged: 0, billed: false, cached: true/);
  assert.match(edge,/result: responseData/);
});

test('vendored MP4 parser is available offline',async()=>{
  const MP4Box=await import('../vendor/mp4box.all.mjs');
  assert.equal(typeof MP4Box.createFile,'function');
  assert.match(sw,/vendor\/mp4box\.all\.mjs/);
  assert.match(sw,/\/vendor\\\/\//);
  assert.ok(fs.statSync(new URL('../vendor/MP4BOX-LICENSE.txt',import.meta.url)).size>1000);
});
