import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'小手机.html'),'utf8');

test('premium home theme keeps all three established color modes',()=>{
  assert.match(html,/\.home\{background:linear-gradient\(155deg,#18151a 0%,#211a20 44%,#171820 100%\)/);
  assert.match(html,/\.home\.tpink\{background:linear-gradient\(165deg,#ffe5ef,#ffd3e1 50%,#f9cfe0\)/);
  assert.match(html,/\.home\.twhite\{background:linear-gradient\(165deg,#ffffff,#f3f3f6 55%,#eaeaee\)/);
  assert.match(html,/\.dock\{[^}]*backdrop-filter:blur\(20px\) saturate\(120%\)/);
});

test('home time, couple avatars, mood face and original app line icons stay intact',()=>{
  assert.match(app,/function wClock\(\)[\s\S]*?<div class="clkT">\$\{hm\(\)\}<\/div>/);
  assert.match(app,/function wCouple2\(\)[\s\S]*?<div class="av2">\$\{cir\(me\)\}\$\{cir\(ta\)\}<\/div>/);
  assert.match(app,/const ic=has\?moodIc\(md\.k,27,col\):svgIc\('smile',26,col\)/);
  assert.match(app,/me:_MI\('<circle cx="12" cy="12" r="8\.4"\/>/);
});

test('music and weather widgets use live artwork without removing custom uploads',()=>{
  assert.match(app,/class="home-record-cover" style="background-image:url\(\$\{s\.cover\}\)"/);
  assert.match(app,/class="home-record\$\{s&&_mPlaying\?' wdisc':''\}"/);
  assert.match(app,/function homeWeatherIcon\(desc,col\)/);
  assert.match(app,/const pic=S\.me\.wPic\?'<img src="'\+S\.me\.wPic\+'">':homeWeatherIcon/);
});

test('WeChat keeps the formal dynamic, microphone and bottom-tab line paths',()=>{
  assert.match(app,/thought:'<path d="M5\.5 10a5 5 0 0 1 9-3 4 4 0 0 1 4\.5 4 3\.4 3\.4 0 0 1-3\.4 3\.4H8\.4A3\.4 3\.4 0 0 1 5\.5 10z"\/><path d="M5 16\.5h\.01M7\.5 19\.5h\.01"\/>',/);
  assert.match(app,/const mood=.*svgIc\('thought',15,'#9a9b9f'\)/);
  assert.match(app,/mic:'<rect x="9" y="3" width="6" height="11" rx="3"\/><path d="M5\.6 11a6\.4 6\.4 0 0 0 12\.8 0M12 17\.4V21M8\.6 21h6\.8"\/>',/);
  assert.match(app,/tb\('chats',svgIc\('chat',23\),'微信'\)/);
  assert.match(app,/tb\('contacts',svgIc\('user',23\),'好友'\)/);
  assert.match(app,/tb\('moments',svgIc\('camera',23\),'朋友圈'\)/);
  assert.match(app,/tb\('me',svgIc\('smile',23\),'我'\)/);
});

test('software lock rendering remains independent of the visual theme',()=>{
  assert.match(app,/const locked=!!\(a\.lk&&appLocked\(k\)\)/);
  assert.match(app,/if\(appLocked\(k\)\)\{toast\('「'\+\(LOCKABLE\[k\]\|\|k\)\+'」已被ta锁定/);
  assert.match(html,/\.home \.app\.app-locked \.ic\{/);
});
