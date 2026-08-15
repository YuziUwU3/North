import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../glass-theme.css',import.meta.url),'utf8');

function functionSource(name){
  const start=app.indexOf(`function ${name}(`);assert.ok(start>=0,`missing ${name}`);
  const brace=app.indexOf('{',start);let depth=0,quote='',escaped=false;
  for(let i=brace;i<app.length;i++){
    const ch=app[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return app.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

test('only wide phones escape the legacy 348px reference cap',()=>{
  assert.match(css,/@media\(min-width:401px\) and \(max-width:649px\)\{[\s\S]*?glass-place-dashboard,[\s\S]*?home \.dock\{max-width:none!important\}/);
  assert.match(css,/@media\(min-width:401px\) and \(max-width:649px\) and \(min-height:820px\)\{/);
  assert.match(css,/glass-place-app-a,[\s\S]*?glass-place-app-b\{top:186px!important\}/);
  assert.doesNotMatch(css,/@media\(min-width:390px\)[\s\S]*?glass-place-dashboard/,'390/393px baseline must not be globally reflowed');
});

test('touchmove is a fallback for WebViews whose pointermove stream is incomplete',()=>{
  const ctx=vm.createContext({clearTimeout(){},homePgScroll(){ctx.paged++;},paged:0,prevented:0});
  vm.runInContext(`let _aPend={x:100,y:100,pan:'',sw:{scrollLeft:0},scroll:null,swLeft:20,scrollTop:0,el:null,pid:1},_aDrag=null,_aTimer=null,_aNoClick=0;${functionSource('appPanMove')};${functionSource('appTouchMove')};globalThis.run=appTouchMove;globalThis.state=()=>_aPend;`,ctx);
  ctx.run({touches:[{clientX:50,clientY:102}],cancelable:true,preventDefault(){ctx.prevented++;}});
  assert.equal(ctx.state().pan,'x');
  assert.equal(ctx.state().sw.scrollLeft,70);
  assert.equal(ctx.paged,1);
  assert.equal(ctx.prevented,1);
  assert.match(functionSource('initAppDrag'),/window\.addEventListener\('blur',appCancel\)/);
  assert.match(functionSource('initAppDrag'),/visibilitychange/);
});

test('own WeChat text and image messages can be deleted without changing recall semantics',async()=>{
  const rows=[
    {id:'mine-text',role:'user',type:'text',content:'hello'},
    {id:'mine-image',role:'user',type:'image',src:'data:image/png;base64,AA'},
    {id:'role-text',role:'assistant',type:'text',content:'reply'}
  ];
  const calls={saved:0,persisted:0,gc:0,closed:0,rendered:0,toasts:[]};
  const vision=new Map([['mine-image',Promise.resolve(true)]]);
  const ctx=vm.createContext({
    msgs(){return rows;},_visionTasks:vision,
    saveNow(){calls.saved++;},persistWechatMessagesNow(){calls.persisted++;return Promise.resolve();},
    imgGC(){calls.gc++;},closeModal(){calls.closed++;},render(){calls.rendered++;},toast(v){calls.toasts.push(v);}
  });
  vm.runInContext(`${functionSource('deleteOwnMsg')};globalThis.remove=deleteOwnMsg;`,ctx);
  ctx.remove('c','mine-text');
  assert.deepEqual(rows.map(x=>x.id),['mine-image','role-text']);
  ctx.remove('c','mine-image');
  assert.deepEqual(rows.map(x=>x.id),['role-text']);
  ctx.remove('c','role-text');
  assert.deepEqual(rows.map(x=>x.id),['role-text'],'role messages keep their separate deletion path');
  await Promise.resolve();
  assert.deepEqual(calls,{saved:2,persisted:2,gc:1,closed:2,rendered:2,toasts:['消息已删除','图片已删除']});
  assert.equal(vision.has('mine-image'),false);
  assert.match(app,/删除这张图片/);
  assert.match(app,/删除这条消息/);
  assert.match(app,/me\?`msgMenu\('\$\{c\.id\}','\$\{m\.id\}'\)`:`viewImg/);
  assert.match(app,/function recallMsg\(cid,mid\)/);
});
