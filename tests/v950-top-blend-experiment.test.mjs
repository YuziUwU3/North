import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');

function experimentSource(){
  const marker='/* 顶部融合真机试验：只响应带参数的苹果设备。正式入口、安卓和私人 App 保持原样。 */';
  const start=html.indexOf(marker);
  assert.notEqual(start,-1);
  const end=html.indexOf('</script>',start);
  assert.notEqual(end,-1);
  return html.slice(start+marker.length,end);
}

function runExperiment({ua='',platform='',maxTouchPoints=0,search='',privateApp=false}={}){
  const status={content:'black',setAttribute(k,v){this[k]=v;}};
  const theme={content:'#ff8fab',setAttribute(k,v){this[k]=v;}};
  const classes=[];
  const window={__SMALL_PHONE_PRIVATE__:privateApp};
  const context=vm.createContext({
    window,
    navigator:{userAgent:ua,platform,maxTouchPoints},
    location:{search},
    URLSearchParams,
    document:{
      documentElement:{classList:{add(v){classes.push(v);}}},
      querySelector(sel){return sel.includes('status-bar-style')?status:theme;}
    }
  });
  vm.runInContext(experimentSource(),context);
  return {active:window.__NORTH_TOP_BLEND_EXPERIMENT__,status:status.content,theme:theme.content,classes};
}

test('top blend is an isolated Apple-only experiment',()=>{
  const iphone=runExperiment({ua:'Mozilla/5.0 (iPhone)',platform:'iPhone',maxTouchPoints:5,search:'?northTopBlend=1'});
  assert.equal(iphone.active,true);
  assert.equal(iphone.status,'black-translucent');
  assert.equal(iphone.theme,'#000000');
  assert.deepEqual(iphone.classes,['north-top-blend-experiment']);

  assert.equal(runExperiment({ua:'Mozilla/5.0 (Linux; Android 15)',platform:'Linux armv8l',maxTouchPoints:5,search:'?northTopBlend=1'}).active,false);
  assert.equal(runExperiment({ua:'Mozilla/5.0 (iPhone)',platform:'iPhone',maxTouchPoints:5}).active,false);
  assert.equal(runExperiment({ua:'Mozilla/5.0 (iPhone)',platform:'iPhone',maxTouchPoints:5,search:'?northTopBlend=1',privateApp:true}).active,false);
});

test('formal shell and the repaired bottom contract stay unchanged',()=>{
  assert.match(html,/<meta name="apple-mobile-web-app-status-bar-style" content="black" \/>/);
  assert.doesNotMatch(html,/<meta name="viewport"[^>]*viewport-fit=cover/);
  assert.match(html,/--north-ios-home-safe-bottom:0px/);
  assert.doesNotMatch(html,/north-top-blend-experiment[^}]*bottom/);
});

test('the experiment installs with its own persistent launch URL',()=>{
  assert.match(html,/var launch=topBlend\?base\+'\?northTopBlend=1':base/);
  assert.match(html,/var man=\{id:launch,name:topBlend\?'North 顶部融合测试':'North'/);
  assert.match(html,/start_url:launch/);
  assert.match(html,/sw\.js\?v=950&r=top-blend-test-1/);
  assert.match(app,/sw\.js\?v=950&r=top-blend-test-1/);
  assert.match(sw,/const HOTFIX='top-blend-test-1'/);
  assert.match(sw,/url\.searchParams\.get\('northTopBlend'\)==='1'/);
  assert.match(sw,/fetch\(request,\{cache:'no-store'\}\)/);
});
