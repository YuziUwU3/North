import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');
const native=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift',import.meta.url),'utf8');
const bridge=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift',import.meta.url),'utf8');

function functionSource(name){
  const start=app.indexOf(`function ${name}(`);
  assert.ok(start>=0,`missing ${name}`);
  const brace=app.indexOf('{',start);
  let depth=0,quote='',escaped=false;
  for(let i=brace;i<app.length;i++){
    const ch=app[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'&&--depth===0)return app.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

test('platform parser accepts Youku, Bilibili IDs, full share text and b23 short links',()=>{
  const context=vm.createContext({String});
  vm.runInContext('this.parse='+functionSource('cinemaPlatformParse'),context);
  assert.deepEqual({...context.parse('https://v.youku.com/v_show/id_XNjA0ODk5NTY0OA==.html')},{provider:'youku',id:'XNjA0ODk5NTY0OA==',idType:'vid',pageUrl:'https://v.youku.com/v_show/id_XNjA0ODk5NTY0OA==.html'});
  assert.equal(context.parse('https://player.youku.com/embed/XNjA0ODk5NTY0OA==').provider,'youku');
  assert.deepEqual({...context.parse('https://www.bilibili.com/video/BV1xx411c7mD')},{provider:'bilibili',id:'BV1xx411c7mD',idType:'bvid',pageUrl:'https://www.bilibili.com/video/BV1xx411c7mD'});
  assert.equal(context.parse('复制这段文字 https://b23.tv/AbC123 打开哔哩哔哩').idType,'short');
  assert.equal(context.parse('https://www.bilibili.com/video/av170001').idType,'aid');
  assert.equal(context.parse('https://evil.example/video/BV1xx411c7mD').provider,'bilibili','a shared BV id remains an explicit official-player identifier');
  assert.equal(context.parse('https://evil.example/watch?id=123456'),null);
});

test('Youku search and playback use current official endpoints without stream scraping',()=>{
  const search=functionSource('cinemaYoukuSearch');
  const player=functionSource('cinemaAfterExternalRender');
  assert.match(search,/https:\/\/openapi\.youku\.com\/v2\/searches\/video\/by_keyword\.json/);
  assert.match(search,/client_id=/);
  assert.match(player,/new YKU\.Player/);
  assert.match(functionSource('cinemaEnsureYoukuApi'),/https:\/\/player\.youku\.com\/jsapi/);
  assert.match(functionSource('cinemaPlayerHTML'),/player\.bilibili\.com\/player\.html/);
  assert.match(functionSource('cinemaBilibiliJSONP'),/api\.bilibili\.com\/x\/web-interface\/view/);
  assert.doesNotMatch(search+player+functionSource('cinemaBilibiliPrepare'),/playurl|m3u8|dash|cookie|Authorization|解锁|解析视频/i);
  assert.match(functionSource('cinemaPlatformOpenPaste'),/优酷官方播放器需要先填写 Client ID/);
});

test('official platform playback keeps role chat honest and preserves the existing sources',()=>{
  assert.match(functionSource('renderCinema'),/正版视频片库/);
  assert.match(functionSource('renderCinema'),/cinemaPickVideo/);
  assert.match(functionSource('renderCinema'),/cinemaOpenOnlineModal/);
  assert.match(functionSource('cinemaRoleContext'),/不要假装知道具体剧情/);
  assert.match(functionSource('cinemaAnalyzeFrame'),/cinemaPlatformScreenFrameData/);
  assert.match(functionSource('cinemaPlatformScreenFrameData'),/screenShare\.frame/);
  assert.match(functionSource('cinemaSubtitleMenu'),/导入 SRT \/ VTT/);
  assert.match(functionSource('cinemaLibraryPlay'),/item\.source==='platform'/);
  assert.match(functionSource('cinemaCurrentTime'),/externalPlayer\.currentTime/);
  assert.match(functionSource('cinemaDuration'),/externalPlayer\.totalTime/);
});

test('private WKWebView embeds only the three explicit official media players',()=>{
  assert.match(native,/host == "music\.163\.com" && url\.path == "\/outchain\/player"/);
  assert.match(native,/host == "player\.youku\.com"/);
  assert.match(native,/host == "player\.bilibili\.com" && url\.path == "\/player\.html"/);
  assert.match(native,/UIApplication\.shared\.open\(url\)/);
  assert.match(bridge,/case "media\.resolveBilibiliShort"/);
  assert.match(bridge,/input\.host\?\.lowercased\(\) == "b23\.tv"/);
  assert.match(html,/\.cin-platform-player/);
  assert.match(html,/\.cin-platform-frame/);
  assert.match(html,/aspect-ratio:16\/9/);
  assert.match(html,/\.cin-platform-results/);
});
