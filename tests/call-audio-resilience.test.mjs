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

assert.match(source,/visibilitychange/);
assert.match(source,/window\.addEventListener\('pageshow',audioKick/);
console.log('call audio resilience tests passed');
