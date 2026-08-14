import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('app.js');
const serviceWorker=read('sw.js');
const manifest=read('native/private-small-phone/Resources/private-phone-web.manifest.json');
const ringtone=fs.readFileSync(new URL('../assets/incoming-wechat-call-default-v2.mp3',import.meta.url));
const bundledRingtone=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/assets/incoming-wechat-call-default-v2.mp3',import.meta.url));
const bundledApp=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js');
const oldRingtones=[
  'incoming-morning-chime-v1.wav',
  'incoming-soft-ring-v1.wav',
  'incoming-warm-night-v1.wav',
  'incoming-wechat-ding-low-v1.wav',
  'incoming-wechat-ding-v1.wav'
];

function functionSource(name){
  const start=source.indexOf('function '+name+'(');
  assert.ok(start>=0,'missing '+name);
  const brace=source.indexOf('{',start);
  let depth=0,quote='',escaped=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error('unterminated '+name);
}

test('the exact new user MP3 is the only bundled WeChat incoming-call ringtone',()=>{
  assert.equal(ringtone.length,144468);
  assert.equal(crypto.createHash('sha256').update(ringtone).digest('hex'),'e25d9464a128b5991d6b688e07c98233cab83c73a64143a8dd9315bed3d36bba');
  assert.deepEqual(bundledRingtone,ringtone);
  assert.match(bundledApp,/const INCOMING_RING_URL='assets\/incoming-wechat-call-default-v2\.mp3'/);
  assert.match(source,/const INCOMING_RING_URL='assets\/incoming-wechat-call-default-v2\.mp3'/);
  assert.match(serviceWorker,/\.\/assets\/incoming-wechat-call-default-v2\.mp3/);
  assert.match(manifest,/assets\/incoming-wechat-call-default-v2\.mp3/);
  for(const file of oldRingtones){
    assert.equal(fs.existsSync(new URL('../assets/'+file,import.meta.url)),false,file+' must be removed');
    assert.doesNotMatch(source,new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    assert.doesNotMatch(serviceWorker,new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    assert.doesNotMatch(manifest,new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  }
});

test('preferences expose one fixed ringtone without old choices or music-library override',()=>{
  assert.match(source,/微信来电铃声/);
  assert.match(source,/已固定为本次提供的 MP3/);
  assert.doesNotMatch(source,/incomingRingMusicModal|incomingRingSongSelect|incomingRingMusicStart|INCOMING_RING_CHOICES/);
  assert.doesNotMatch(source,/从音乐库选择来电铃声|微信高低轻响|清脆双响|木质叮咚/);
  assert.doesNotMatch(source,/incomingRingSongId|incomingRing:'soft'/);
});

test('incoming calls loop only the fixed MP3 and retain iOS media fallback and vibration',()=>{
  assert.equal(functionSource('incomingRingUrl'),"function incomingRingUrl(){return INCOMING_RING_URL;}");
  const start=functionSource('ringStart');
  const assetStart=functionSource('ringAssetStart');
  assert.match(start,/ringToneElement\(\)/);
  assert.match(start,/uiToneElement\(\)/);
  assert.match(start,/S\.settings\.sound/);
  assert.match(start,/navigator\.vibrate/);
  assert.match(assetStart,/a\.loop=true/);
  assert.match(assetStart,/a\.src=url\|\|incomingRingUrl\(\)/);
  assert.doesNotMatch(start+assetStart,/playMediaTone|webToneSequence|incomingRingKey|music/);
});

test('sound-off incoming calls do not start ringtone playback',()=>{
  const start=functionSource('ringStart');
  const soundCheck=start.indexOf('if(S.settings.sound)');
  const primary=start.indexOf('ringToneElement()');
  assert.ok(soundCheck>=0&&primary>soundCheck);
});
