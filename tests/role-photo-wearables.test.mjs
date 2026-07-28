import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const backend=fs.readFileSync(new URL('../supabase/functions/phone-ai/index.ts',import.meta.url),'utf8');

function functionSource(source,name){
  const start=source.indexOf(`function ${name}`);
  assert.ok(start>=0,`missing ${name}`);
  const next=source.indexOf('\nfunction ',start+9);
  return source.slice(start,next<0?source.length:next);
}

const context=vm.createContext({});
for(const name of ['rolePhotoClothesOnlyRequest','rolePhotoWearableKind','rolePhotoOutfitRequest','rolePhotoSceneOnlyRequest']){
  vm.runInContext(functionSource(app,name),context);
}

assert.equal(context.rolePhotoWearableKind('发呀黑白色女仆装，记得拍身材好一点'),'outfit');
assert.equal(context.rolePhotoWearableKind('我想看你的西装'),'outfit');
assert.equal(context.rolePhotoWearableKind('手表戴在手上，只拍一只手给我'),'hand');
assert.equal(context.rolePhotoWearableKind('把戒指戴起来给我看'),'hand');
assert.equal(context.rolePhotoWearableKind('给我看看你戴的项链'),'neck');
assert.equal(context.rolePhotoWearableKind('把鞋穿上拍脚部'),'feet');
assert.equal(context.rolePhotoWearableKind('把新买的胸针佩戴上给我看看'),'wearable');
assert.equal(context.rolePhotoWearableKind('把手表摘下来放桌上，只拍手表本身'),'');
assert.equal(context.rolePhotoClothesOnlyRequest('把手表摘下来放桌上，只拍手表本身'),true);
assert.equal(context.rolePhotoClothesOnlyRequest('只拍衣架上挂着的西装'),true);
assert.equal(context.rolePhotoSceneOnlyRequest('在卧室拍你穿黑白女仆装的全身照'),false);
assert.equal(context.rolePhotoSceneOnlyRequest('拍一下卧室桌面'),true);

const promptContext=vm.createContext({
  msgs:()=>[{role:'user',content:'发呀女仆装黑白色的哦，记得拍身材好一点'}],
  msgToText:m=>m.content,
  buildImgLock:()=>({}),
  sanitizeRolePhotoScene:s=>s,
  rolePhotoPairWithUser:()=>false,
  rolePhotoGender:()=>({cn:'成年男性'}),
  rolePhotoSceneLogic:()=>'',
  rolePhotoPeoplePolicy:()=>'',
  roleVisualIdentity:()=>'',
});
for(const name of ['rolePhotoClothesOnlyRequest','rolePhotoWearableKind','rolePhotoOutfitRequest','rolePhotoWearablePlacement','rolePhotoSceneOnlyRequest','rolePhotoLatestUserImageRequest','charImgPrompt']){
  vm.runInContext(functionSource(app,name),promptContext);
}
const maidPrompt=promptContext.charImgPrompt({id:'c1'},'床上叠放着一套黑白女仆装');
assert.match(maidPrompt,/穿戴成片原则/);
assert.match(maidPrompt,/服装完整穿在当前角色本人身上/);
assert.match(maidPrompt,/不要只拍物品、衣架、床、桌面或空房间/);

promptContext.msgs=()=>[{role:'user',content:'我想看你的手表，只拍一只手给我'}];
const watchPrompt=promptContext.charImgPrompt({id:'c1'},'桌上放着一块银色手表');
assert.match(watchPrompt,/手表和手链戴在手腕/);
assert.match(watchPrompt,/只拍一只手给我/);

promptContext.msgs=()=>[{role:'user',content:'把鞋穿上拍给我看'}];
const shoesPrompt=promptContext.charImgPrompt({id:'c1'},'地上放着一双黑色鞋');
assert.match(shoesPrompt,/鞋、靴、袜或脚链穿戴在脚部/);
assert.match(shoesPrompt,/不把构图固定成某一种/);

promptContext.msgs=()=>[{role:'user',content:'戴上眼镜拍给我看'}];
const glassesPrompt=promptContext.charImgPrompt({id:'c1'},'桌上有一副眼镜');
assert.match(glassesPrompt,/眼镜或墨镜戴在头上/);
assert.match(glassesPrompt,/不把构图固定成某一种/);

assert.match(app,/服装与饰品默认实际穿戴/);
assert.match(backend,/Follow any framing the user explicitly requested/);
assert.match(backend,/Never replace a requested worn-item photo with the item lying on a bed/);

console.log('role photo wearable tests passed');
