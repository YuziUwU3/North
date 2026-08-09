import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

function standaloneScript(){
  const marker='/* 少数旧 iOS / 第三方主屏容器会把可用高度少算一个底部安全区';
  const at=html.indexOf(marker),start=html.lastIndexOf('<script>',at)+8,end=html.indexOf('</script>',at);
  assert.ok(at>0&&start>7&&end>start);
  return html.slice(start,end);
}

function shellSandbox({standalone=true,innerHeight=803,screenHeight=852}={}){
  const classes=new Set(),props=new Map(),listeners={};
  const root={clientWidth:393,clientHeight:innerHeight,classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)},style:{setProperty:(k,v)=>props.set(k,v),removeProperty:k=>props.delete(k)}};
  const sandbox={navigator:{standalone,maxTouchPoints:5},screen:{width:393,height:screenHeight},document:{documentElement:root,activeElement:null,addEventListener(){}},innerWidth:393,innerHeight,matchMedia:q=>({matches:q.includes('pointer: coarse')}),setTimeout:fn=>{fn();return 1;},clearTimeout(){},addEventListener:(name,fn)=>{listeners[name]=fn;}};
  sandbox.window=sandbox;
  vm.runInNewContext(standaloneScript(),sandbox);
  return{sandbox,root,classes,props,listeners};
}

test('older standalone touch shells fill a short viewport without following the keyboard',()=>{
  assert.match(html,/viewport-fit=cover/);
  assert.match(html,/navigator\.standalone===true/);
  assert.match(html,/\(display-mode: standalone\)/);
  assert.match(html,/\(navigator\.maxTouchPoints\|\|0\)>0/);
  assert.match(html,/if\(!reset&&editing\(\)\)return/);
  assert.match(html,/if\(sh>=ih&&sh-ih<=180\)target=sh/);
  assert.match(html,/html\.north-standalone-shell body/);
  assert.match(html,/--north-shell-height/);
  assert.doesNotMatch(html,/min-height:-webkit-fill-available/,'the smaller WebKit available height must not override the real screen height again');
  assert.doesNotMatch(app,/function syncAppViewport|--north-app-height/,'the compatibility fix must not restore the keyboard-sensitive global viewport script');
});

test('short standalone viewport expands to the stable screen height and ignores keyboard shrink',()=>{
  const x=shellSandbox();
  assert.equal(x.props.get('--north-shell-height'),'852px');
  assert.ok(x.classes.has('north-standalone-shell'));
  x.sandbox.document.activeElement={tagName:'INPUT'};
  x.sandbox.innerHeight=500;
  x.sandbox.__northStandaloneShellSync(false);
  assert.equal(x.props.get('--north-shell-height'),'852px');
});

test('ordinary browser never receives the standalone height override',()=>{
  const x=shellSandbox({standalone:false,innerHeight:803,screenHeight:852});
  assert.equal(x.props.has('--north-shell-height'),false);
  assert.equal(x.classes.has('north-standalone-shell'),false);
});
