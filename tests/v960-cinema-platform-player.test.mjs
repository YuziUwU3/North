import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');
const native=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift',import.meta.url),'utf8');
const bridge=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift',import.meta.url),'utf8');
const pipAudio=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/CallPictureInPictureController.swift',import.meta.url),'utf8');
const broadcast=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneScreenBroadcast/SampleHandler.swift',import.meta.url),'utf8');

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

test('platform parser accepts Bilibili IDs, full share text and b23 short links only',()=>{
  const context=vm.createContext({String});
  vm.runInContext('this.parse='+functionSource('cinemaPlatformParse'),context);
  assert.equal(context.parse('https://v.youku.com/v_show/id_XNjA0ODk5NTY0OA==.html'),null);
  assert.equal(context.parse('https://player.youku.com/embed/XNjA0ODk5NTY0OA=='),null);
  assert.deepEqual({...context.parse('https://www.bilibili.com/video/BV1xx411c7mD')},{provider:'bilibili',id:'BV1xx411c7mD',idType:'bvid',pageUrl:'https://www.bilibili.com/video/BV1xx411c7mD'});
  assert.equal(context.parse('复制这段文字 https://b23.tv/AbC123 打开哔哩哔哩').idType,'short');
  assert.equal(context.parse('https://www.bilibili.com/video/av170001').idType,'aid');
  assert.deepEqual({...context.parse('https://b23.tv/ep5137671')},{provider:'bilibili',id:'5137671',idType:'episode',pageUrl:'https://www.bilibili.com/bangumi/play/ep5137671'});
  assert.equal(context.parse('复制这段文字打开哔哩哔哩 https://b23.tv/ep5137671 看完整视频').idType,'episode');
  assert.equal(context.parse('ep5137671').idType,'episode');
  assert.equal(context.parse('https://www.bilibili.com/bangumi/play/ss105212').idType,'season');
  assert.equal(context.parse('https://evil.example/video/BV1xx411c7mD').provider,'bilibili','a shared BV id remains an explicit official-player identifier');
  assert.equal(context.parse('https://evil.example/watch?id=123456'),null);
});

test('Youku application surface is removed while Bilibili official playback remains',()=>{
  assert.equal(app.includes('function cinemaYoukuSearch('),false);
  assert.equal(app.includes('function cinemaEnsureYoukuApi('),false);
  assert.equal(app.includes('cinYoukuPlayer'),false);
  assert.equal(app.includes('openapi.youku.com'),false);
  assert.equal(app.includes('new YKU.Player'),false);
  assert.equal(html.includes('cinYoukuPlayer'),false);
  assert.equal(native.includes('player.youku.com'),false);
  assert.match(functionSource('cinemaPlayerHTML'),/player\.bilibili\.com\/player\.html/);
  assert.match(functionSource('cinemaPlayerHTML'),/episodeId=/);
  assert.match(functionSource('cinemaPlayerHTML'),/seasonId=/);
  assert.match(functionSource('cinemaBilibiliJSONP'),/api\.bilibili\.com\/x\/web-interface\/view/);
  assert.doesNotMatch(functionSource('cinemaAfterExternalRender')+functionSource('cinemaBilibiliPrepare'),/playurl|m3u8|dash|cookie|Authorization|解锁|解析视频/i);
  assert.match(functionSource('cinemaPlatformOpenPaste'),/正在读取B站视频信息/);
  assert.match(functionSource('cinemaOpenPlatformModal'),/B站视频片库/);
  assert.doesNotMatch(functionSource('cinemaOpenPlatformModal'),/Client ID|保存 ID/);
});

test('official platform playback keeps role chat honest and preserves the existing sources',()=>{
  assert.match(functionSource('renderCinema'),/正版视频片库/);
  assert.match(functionSource('renderCinema'),/cinemaPickVideo/);
  assert.match(functionSource('renderCinema'),/cinemaOpenOnlineModal/);
  assert.match(functionSource('cinemaRoleContext'),/不要假装知道具体剧情/);
  assert.match(functionSource('cinemaAnalyzeFrame'),/cinemaPlatformScreenFrameData/);
  assert.match(functionSource('cinemaPlatformScreenFrameData'),/screenShare\.frame/);
  assert.match(functionSource('cinemaPlatformScreenFrameData'),/cinemaCropPlatformFrame/);
  assert.match(functionSource('cinemaCropPlatformFrame'),/\.cin-platform-frame/);
  assert.match(functionSource('cinemaCropPlatformFrame'),/drawImage\(img,left,top,width,height/);
  assert.match(functionSource('cinemaSubtitleMenu'),/导入 SRT \/ VTT/);
  assert.match(functionSource('cinemaLibraryPlay'),/item\.source==='platform'/);
  assert.doesNotMatch(functionSource('cinemaCurrentTime'),/externalPlayer/);
  assert.doesNotMatch(functionSource('cinemaDuration'),/externalPlayer/);
});

test('private cinema screen frames keep ReplayKit orientation and role speech mixes with playback',()=>{
  assert.match(broadcast,/RPVideoSampleOrientationKey/);
  assert.match(broadcast,/CGImagePropertyOrientation/);
  assert.match(broadcast,/input = input\.oriented\(orientation\)/);
  assert.match(functionSource('playCallMediaWait'),/nativeCinema/);
  assert.match(functionSource('playCallMediaWait'),/mixMode:nativeCinema\?'cinema':'call'/);
  assert.doesNotMatch(functionSource('playCallMediaWait'),/cinemaMicPauseForRole/);
  assert.match(bridge,/arguments\["mixMode"\] as\? String == "cinema"/);
  assert.match(bridge,/mixWithMedia: mixWithMedia/);
  assert.match(pipAudio,/mixWithMedia: Bool = false/);
  assert.match(pipAudio,/if mixWithMedia \{[\s\S]*?\.playAndRecord,[\s\S]*?mode: \.default,[\s\S]*?\.mixWithOthers/);
});

test('private WKWebView embeds only the explicit NetEase and Bilibili media players',()=>{
  assert.match(native,/host == "music\.163\.com" && url\.path == "\/outchain\/player"/);
  assert.doesNotMatch(native,/player\.youku\.com/);
  assert.match(native,/host == "player\.bilibili\.com" && url\.path == "\/player\.html"/);
  assert.match(native,/host == "www\.bilibili\.com"[\s\S]*?\/blackboard\/webplayer\/mbplayer\.html/);
  assert.match(native,/\/blackboard\/html5mobileplayer\.html/);
  assert.match(native,/UIApplication\.shared\.open\(url\)/);
  assert.match(bridge,/case "media\.resolveBilibiliShort"/);
  assert.match(bridge,/input\.host\?\.lowercased\(\) == "b23\.tv"/);
  assert.match(bridge,/\/bangumi\/play\/ep/);
  assert.match(bridge,/\/bangumi\/play\/ss/);
  assert.match(html,/\.cin-platform-player/);
  assert.match(html,/\.cin-platform-frame/);
  assert.match(html,/\.cin-platform-stage \.cin-danmaku,\.cin-platform-stage \.cin-sub,\.cin-platform-stage \.cin-voice-sub\{pointer-events:none\}/);
  assert.doesNotMatch(html,/\.cin-platform-stage \.cin-danmaku[^}]*\{pointer-events:auto\}/);
  assert.doesNotMatch(native,/hasSuffix\("bilibili\.com"\)/,'the native allowlist must not broaden to arbitrary Bilibili pages');
  assert.match(html,/aspect-ratio:16\/9/);
  assert.doesNotMatch(html,/cinYoukuPlayer/);
});
