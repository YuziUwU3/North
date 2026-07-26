import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

function functionSource(name,next='function '){
  const start=source.indexOf('function '+name+'(');
  assert.ok(start>=0,'missing '+name);
  const end=source.indexOf('\n'+next,start+10);
  return source.slice(start,end<0?source.length:end).trim();
}

const render=functionSource('renderSettings');
const tools=functionSource('settingsDataToolsHTML');
const page1=render.indexOf('id="setpage1"');
const image=render.indexOf('id="set_image"');
const page2=render.indexOf('id="setpage2"');
const page3=render.indexOf('id="setpage3"');

assert.ok(page1>=0&&image>page1&&page2>image,'AI 真图 must stay on interface/model page 1');
assert.ok(page3>page2,'authorization/data page must be the third page');
assert.match(render,/settingsJump\(1,'set_image'\)/);
assert.doesNotMatch(render.slice(page2,page3),/settingsJump\(1,/,'preference page must not repeat page 1 shortcuts');
assert.doesNotMatch(render.slice(page2,page3),/id="set_image"/,'preference page must not repeat AI image settings');
assert.match(tools,/settingsJump\(3,'set_license'\)/);
assert.match(tools,/settingsJump\(3,'set_layout'\)/);
assert.match(tools,/settingsJump\(3,'set_backup'\)/);
assert.match(tools,/settingsJump\(3,'set_storage'\)/);
assert.match(render,/_setTab===3\?settingsDataToolsSafeHTML\(\):''/);
assert.match(render,/return settingsTabTap\(event,3\)/);
assert.ok(tools.indexOf('licenseStatusSection()')<tools.indexOf('clearAllData()'));
assert.ok(tools.indexOf('storageMeter()')<tools.indexOf('clearAllData()'));

const nodes={};
for(let i=1;i<=3;i++){
  nodes['setpage'+i]={style:{},dataset:{},innerHTML:''};
  nodes['settab'+i]={style:{}};
}
nodes.setSaveButton={style:{}};
nodes.settingsscroll={scrollTop:88};
let builds=0;
const context=vm.createContext({
  $:id=>nodes[id.slice(1)]||null,
  settingsDataToolsHTML:()=>{builds++;return '<div id="set_license"></div>';}
});
vm.runInContext(functionSource('settingsDataToolsSafeHTML')+'\n'+functionSource('setTab')+';globalThis.setTab=setTab;',context);
context.setTab(2);
assert.equal(nodes.setpage1.style.display,'none');
assert.equal(nodes.setpage2.style.display,'block');
assert.equal(nodes.setpage3.style.display,'none');
assert.equal(builds,0,'data tools must not render on preference page');
context.setTab(3);
assert.equal(nodes.setpage3.style.display,'block');
assert.equal(nodes.setSaveButton.style.display,'none');
assert.equal(builds,1,'data tools load only when page 3 is opened');
context.setTab(1);
context.setTab(3);
assert.equal(builds,1,'page 3 must reuse its loaded DOM instead of rebuilding while switching tabs');

const brokenNodes={};
for(let i=1;i<=3;i++){
  brokenNodes['setpage'+i]={style:{},dataset:{},innerHTML:''};
  brokenNodes['settab'+i]={style:{}};
}
brokenNodes.setSaveButton={style:{}};
brokenNodes.settingsscroll={scrollTop:12};
const broken=vm.createContext({
  $:id=>brokenNodes[id.slice(1)]||null,
  settingsDataToolsHTML:()=>{throw new Error('license metadata unavailable');}
});
vm.runInContext(functionSource('settingsDataToolsSafeHTML')+'\n'+functionSource('setTab')+';globalThis.setTab=setTab;',broken);
broken.setTab(3);
assert.equal(brokenNodes.setpage3.style.display,'block','an authorization read error must stay on settings page 3');
assert.match(brokenNodes.setpage3.innerHTML,/授权与数据暂时读取失败/);

console.log('settings pagination tests passed');
