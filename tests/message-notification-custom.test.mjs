import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('app.js');
const sw=read('sw.js');
const manifest=read('native/private-small-phone/Resources/private-phone-web.manifest.json');
const asset=fs.readFileSync(new URL('../assets/message-notification-user-v1.mp3',import.meta.url));
const functionSource=name=>{const start=source.indexOf('function '+name+'(');assert.ok(start>=0,'missing '+name);let brace=source.indexOf('{',start),depth=0;for(let i=brace;i<source.length;i++){if(source[i]==='{')depth++;else if(source[i]==='}'&&!--depth)return source.slice(start,i+1);}throw new Error('unterminated '+name);};

test('the exact user MP3 is bundled for web, offline cache and the private app',()=>{
  assert.equal(asset.length,13271);
  assert.equal(crypto.createHash('sha256').update(asset).digest('hex'),'bc254a6d50ed59c0d0949623f89127de4572c5c058eeaa43c04d543417cbe44e');
  assert.match(sw,/\.\/assets\/message-notification-user-v1\.mp3/);
  assert.match(manifest,/assets\/message-notification-user-v1\.mp3/);
});

test('role and real-friend incoming messages share the MP3 without replacing call ringtones',()=>{
  assert.match(source,/const MESSAGE_NOTIFICATION_URL='assets\/message-notification-user-v1\.mp3'/);
  assert.match(functionSource('playMessageDing'),/messageToneElement\(\)/);
  assert.match(functionSource('playMessageDing'),/\.72\*volMul\(\)/);
  assert.match(functionSource('notifyIncoming'),/playMessageDing\(\)/);
  assert.match(functionSource('pfNotifyFriend'),/playMessageDing\(\)/);
  assert.match(functionSource('pfNotifyGroup'),/playMessageDing\(\)/);
  assert.match(functionSource('gNotify'),/playMessageDing\(\)/);
  assert.match(functionSource('audioMediaWake'),/messageToneElement\(\)/);
  assert.doesNotMatch(functionSource('incomingRingUrl'),/MESSAGE_NOTIFICATION_URL/);
});
