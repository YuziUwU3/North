import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

function functionSource(name){
  const start=source.indexOf(`function ${name}`);
  assert.ok(start>=0,`missing ${name}`);
  const brace=source.indexOf('{',start);
  let depth=0,quote='',escaped=false,regex=false,regexClass=false,prev='';
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(regex){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='[')regexClass=true;else if(ch===']')regexClass=false;else if(ch==='/'&&!regexClass)regex=false;continue;}
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='/'&&source[i+1]!=='/'&&source[i+1]!=='*'&&/[=(,:;!&|?\[{]/.test(prev)){regex=true;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
    if(!/\s/.test(ch))prev=ch;
  }
  throw new Error(`unterminated ${name}`);
}

const durationContext=vm.createContext({Math,Number,VOICE_MAX_SECONDS:60});
for(const name of ['stripSpoken','ttsCleanBase','voiceEstimatedSeconds','callSpeechDurationPlausible'])vm.runInContext(functionSource(name),durationContext);
assert.equal(durationContext.callSpeechDurationPlausible('嗯？',.2),true,'very short interjections must remain valid');
assert.equal(durationContext.callSpeechDurationPlausible('路上注意安全，到了跟我说一声好不好，我在这里等你消息。',.8),false,'obviously truncated Chinese audio must be rejected');
assert.equal(durationContext.callSpeechDurationPlausible('路上注意安全，到了跟我说一声好不好，我在这里等你消息。',5),true,'normal Chinese audio must remain valid');
assert.equal(durationContext.callSpeechDurationPlausible('Please remember your umbrella when you go outside tonight.',.5),false,'obviously truncated English audio must be rejected');
assert.doesNotMatch(functionSource('callSpeechDurationPlausible'),/\\p\{/,'older Android engines must not parse Unicode property escapes');

let intervalCallback=null,started=false,settled=false;
const playbackSource={connect(){},start(){started=true;},stop(){if(this.onended)this.onended();}};
const playbackAudio={
  state:'running',currentTime:0,destination:{},resumeCalls:0,
  resume(){this.resumeCalls++;return Promise.resolve();},
  createBufferSource(){return playbackSource;},
  createGain(){return{gain:{value:1},connect(){}};},
};
const playbackContext=vm.createContext({
  _audio:playbackAudio,_curSrc:null,Math,Number,String,Date,Promise,
  ensureAudio(){},volMul:()=>1,
  setTimeout,clearTimeout,
  setInterval(fn){intervalCallback=fn;return 1;},clearInterval(){},
});
vm.runInContext(functionSource('stopBufSource'),playbackContext);
vm.runInContext('async '+functionSource('callAudioReady'),playbackContext);
vm.runInContext('async '+functionSource('playBufWait'),playbackContext);
const playback=playbackContext.playBufWait({duration:2},()=>{}).then(value=>{settled=true;return value;});
await Promise.resolve();
assert.equal(started,true);
playbackAudio.state='suspended';
intervalCallback();
await Promise.resolve();
assert.equal(settled,false,'a suspended AudioContext must not advance to the next sentence');
assert.equal(playbackAudio.resumeCalls,1,'suspended playback should request a safe resume');
playbackAudio.state='running';
playbackAudio.currentTime=4;
intervalCallback();
assert.equal(await playback,true,'playback should finish after the real audio clock catches up');

let generateCalls=0,refundCalls=0;
const retryContext=vm.createContext({
  ttsUseRelay:()=>true,
  async ttsArr(){generateCalls++;return{attempt:generateCalls};},
  async decodeBuf(ab){return{duration:ab.attempt===1?.2:4};},
  callSpeechDurationPlausible:(_text,duration)=>duration>=1,
  async ttsRefundAudio(){refundCalls++;return true;},
});
vm.runInContext('async '+functionSource('prepareCallSpeech'),retryContext);
const retried=await retryContext.prepareCallSpeech('这是一句足够长的测试语音',{},{});
assert.equal(generateCalls,2,'a confirmed-refunded truncated relay response should retry once');
assert.equal(refundCalls,1);
assert.equal(retried.buf.duration,4);

generateCalls=0;refundCalls=0;
retryContext.ttsRefundAudio=async()=>{refundCalls++;return false;};
const notRetried=await retryContext.prepareCallSpeech('这是一句足够长的测试语音',{},{});
assert.equal(notRetried,null);
assert.equal(generateCalls,1,'relay synthesis must not retry when refund was not confirmed');
assert.equal(refundCalls,1);

let now=5000,created=0,closed=0,resumed=0;
class FakeAudioContext{
  constructor(){created++;this.state='suspended';}
  close(){closed++;this.state='closed';}
  resume(){resumed++;return Promise.resolve();}
}
const staleAudio={state:'suspended',close(){closed++;this.state='closed';},resume(){resumed++;return Promise.resolve();}};
const recoveryContext=vm.createContext({
  _audio:staleAudio,_audioBornAt:0,_curSrc:{},window:{AudioContext:FakeAudioContext},Date:{now:()=>now},Promise,
});
vm.runInContext(functionSource('ensureAudio'),recoveryContext);
const recovered=recoveryContext.ensureAudio(true);
assert.notEqual(recovered,staleAudio,'a stale suspended context should be replaced on the next user gesture');
assert.equal(closed,1);
assert.equal(created,1);
assert.equal(recoveryContext._curSrc,null);
now+=200;
assert.equal(recoveryContext.ensureAudio(true),recovered,'the pointerdown and click from one gesture must reuse the fresh context');
assert.equal(created,1,'one gesture must not repeatedly rebuild the audio context');
assert.ok(resumed>=2,'audio recovery should request resume on both the stale replacement and the follow-up gesture');

let pulseNow=9000,pulseStarts=0,pulseCloses=0,pulseCancels=0;
const pulseSamples=new Float32Array(32);
const runningAudio={
  state:'running',destination:{},
  resume(){return Promise.resolve();},
  close(){pulseCloses++;this.state='closed';return Promise.resolve();},
  createBuffer(){return{getChannelData(){return pulseSamples;}};},
  createBufferSource(){return{connect(){},start(){pulseStarts++;}};},
};
const pulseContext=vm.createContext({
  _audio:runningAudio,_audioBornAt:pulseNow,_audioPulseAt:0,_curSrc:null,
  window:{AudioContext:FakeAudioContext,speechSynthesis:{cancel(){pulseCancels++;}}},
  speechSynthesis:{cancel(){pulseCancels++;}},Date:{now:()=>pulseNow},Promise,
});
vm.runInContext(functionSource('stopBufSource'),pulseContext);
vm.runInContext(functionSource('ensureAudio'),pulseContext);
vm.runInContext(functionSource('audioUnlock'),pulseContext);
vm.runInContext(functionSource('audioRouteReset'),pulseContext);
pulseContext.audioUnlock();
assert.equal(pulseStarts,1,'a context reporting running must still receive a real unlock pulse');
assert.ok(pulseSamples[0]>0&&pulseSamples[0]<.00002,'the unlock pulse must not be optimized away as an empty buffer');
pulseContext.audioUnlock();
assert.equal(pulseStarts,1,'one tap must not create duplicate unlock sources');
pulseNow+=181;
pulseContext.audioUnlock();
assert.equal(pulseStarts,2,'a later user gesture may repair a silent output route again');
pulseContext.audioRouteReset(false);
assert.equal(pulseCloses,1,'ending a call must release the communication AudioContext');
assert.equal(pulseContext._audio,null);
assert.ok(pulseCancels>=1,'ending a call must also stop device speech output');

assert.match(source,/visibilitychange/);
assert.match(source,/window\.addEventListener\('pageshow',audioKick/);
assert.match(functionSource('callHFToggle'),/callHFStop\(\);audioRouteReset\(true\)/);
assert.match(functionSource('declineCall'),/audioRouteReset\(true\)/);
assert.match(functionSource('hangupCall'),/audioRouteReset\(!byAI\)/);
assert.match(source,/pagehide',\(\)=>\{if\(_callHF\)\{callHFStop\(\);audioRouteReset\(false\);\}/);
console.log('call audio resilience tests passed');
