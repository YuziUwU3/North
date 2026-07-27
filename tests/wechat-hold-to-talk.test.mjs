import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');

assert.match(app,/onclick="toggleChatVoiceMode\(\)"/);
assert.match(app,/id="holdbtn" class="holdtalk"/);
assert.match(app,/onpointerdown="recDown\(event,'\$\{id\}'\)"/);
assert.match(app,/onpointerup="recUp\(event,'\$\{id\}',false\)"/);
assert.match(app,/onpointercancel="recUp\(event,'\$\{id\}',true\)"/);
assert.match(app,/setPointerCapture\(ev\.pointerId\)/);
assert.match(app,/if\(_chatRecPress!==press\|\|!press\.down\)\{stopRec\(true/);
assert.match(app,/onLimit:\(\)=>\{if\(_chatRecPress!==press\|\|!_rec\)return/);
assert.match(app,/toast\('已到60秒，自动发送'\);finishChatRec\(id,false,false\)/);
assert.match(app,/let _voiceMode=false;let _panelPage='fn',_chatRecPress=null,_chatRecProcessing=false/);
assert.match(app,/正在识别上一条语音/);
assert.match(app,/await imgPut\('__audio_'\+mid,audio\);audio='idb-audio:'\+mid/);
assert.match(app,/pushMsg\(id,\{role:'user',type:'voice',audio/);
assert.match(app,/这台设备没有转写出可听懂的内容/);
assert.match(app,/你不能假装听清了，更不能编造ta说过什么/);
assert.match(app,/function sendText[\s\S]*?pushMsg\(id,\{role:'user',type:'text'/);
assert.doesNotMatch(app,/打字→发成语音条/);

assert.match(html,/\.inputbar \.holdtalk\{[^}]*touch-action:none/);
assert.match(html,/\.wxlight \.inputbar \.holdtalk\{background:#fff/);
assert.match(html,/\.wxlight \.inputbar \.holdtalk\.recording\{background:#e4e4e7/);

console.log('wechat hold-to-talk tests passed');
