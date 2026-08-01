import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import vm from 'node:vm';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const app=readFileSync(join(root,'app.js'),'utf8');
const html=readFileSync(join(root,'小手机.html'),'utf8');

function functionSource(name){
  const asyncStart=app.indexOf(`async function ${name}`);
  const start=asyncStart>=0?asyncStart:app.indexOf(`function ${name}`);
  assert.ok(start>=0,`missing ${name}`);
  const brace=app.indexOf('{',start);
  let depth=0,quote='',escaped=false;
  for(let i=brace;i<app.length;i++){
    const ch=app[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return app.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

test('game hall exposes the advanced draw-and-guess room',()=>{
  assert.match(app,/\{k:'drawguess',e:'',n:'你画我猜'/);
  assert.match(app,/else if\(c\.p==='gameshub'\)html=renderGameHub\(\)/);
  assert.match(app,/else if\(c\.p==='drawguess'\)html=renderDrawGuess\(\)/);
  assert.match(functionSource('renderGameHub'),/我的画作/);
  assert.match(functionSource('startGame'),/k==='drawguess'/);
  assert.match(html,/\.gamehub-grid/);
  assert.match(html,/\.dg-canvas-shell/);
});

test('setup has free topics, role-picked topics and a separate photo continuation mode',()=>{
  const setup=functionSource('dgOpenSetup'),start=functionSource('dgStartNew');
  assert.match(setup,/id="dg_topic"/);
  assert.match(setup,/让我画/);
  assert.match(setup,/让 TA 画/);
  assert.match(setup,/上传图片让 TA 画/);
  assert.doesNotMatch(setup,/dg_duration|每轮作画时间/);
  assert.doesNotMatch(start,/dgPickWord|DG_WORDS/,'new rounds must not draw from the old fixed word list');
  assert.match(start,/mode==='photo'/);
  assert.match(start,/dgBeginState\(cid,'photo'/);
});

test('canvas controls and durable gallery saving do not depend on the mounted canvas',()=>{
  const render=functionSource('renderDrawGuess'),archive=functionSource('dgArchive');
  assert.match(render,/相册底图/);
  assert.match(render,/撤回一笔/);
  assert.match(render,/清空画布/);
  assert.match(render,/dgSetWidth\(13,this\)/);
  assert.match(render,/保存画作/);
  assert.match(functionSource('dgSnapshotData'),/document\.createElement\('canvas'\)/);
  assert.match(archive,/dgSnapshotData/);
  assert.match(archive,/primeImageForSave/);
  assert.match(archive,/saveNowAsync/);
  assert.match(archive,/savedRevision===g\.revision/);
  assert.match(functionSource('dgDeleteArtwork'),/gallery=x\.gallery\.filter/);
});

test('role drawing is recognizable vector work and animates at human pace without per-stroke API calls',()=>{
  const context=vm.createContext({Math});
  for(const name of ['dgLine','dgEllipse','dgRect','dgFallbackPlan','dgNormalizePlan'])vm.runInContext(functionSource(name),context);
  const tree=context.dgFallbackPlan('大树');
  assert.ok(tree.length>=18,'tree fallback needs trunk outlines, branches, crown clusters and ground details');
  assert.ok(tree.every(s=>s.width>=6&&s.points.length>=2));
  const generated=functionSource('dgGenerateRoleDrawing'),animate=functionSource('dgAnimateNext');
  assert.match(generated,/完整具体的物体结构/);
  assert.match(generated,/不要从固定词库随机抽/);
  assert.match(generated,/根据你和.*真实相处/);
  assert.match(generated,/finishSpeech/,'finish dialogue is generated in the same planning call');
  assert.match(animate,/drawMs/);
  assert.match(animate,/240\+/,'there is a visible human pause between strokes');
  assert.match(animate,/requestAnimationFrame/);
  assert.doesNotMatch(animate,/chatAPI|visionAPI|imageAPI/,'animation must never call an API for each stroke');
});

test('role dialogue uses the same game context and never fabricates player speech',()=>{
  const system=functionSource('dgRoleSystem'),messages=functionSource('dgRoleChatMessages');
  assert.match(system,/buildSystem\(c/);
  assert.match(system,/gameContextRounds\(\)/);
  assert.match(system,/绝不能替/);
  assert.match(messages,/msgs\(c\.id\)/,'wechat history is carried into the drawing room');
  assert.match(functionSource('dgAddDialogue'),/who==='ta'.*roleSpeech.*else.*meSpeech/);
  assert.doesNotMatch(functionSource('dgBeginState'),/我来猜|我画好了|题目只有我知道/);
  assert.doesNotMatch(functionSource('dgTimeUp'),/roleSpeech\s*=|meSpeech\s*=/);
  assert.doesNotMatch(functionSource('dgSubmitGuess'),/还不是|不对，再|差一点/);
});

test('guessing reuses one vision description and role feedback or edits come from the model',()=>{
  const ask=app.slice(app.indexOf('async function dgAskRoleGuess'),app.indexOf('function dgHintRole')),guide=functionSource('dgGuideRole');
  assert.match(functionSource('dgTimeUp'),/dgFinishDrawing/);
  assert.match(functionSource('dgTimeUp'),/phase='done'/);
  assert.match(ask,/if\(!g\.visionDesc\)/);
  assert.match(ask,/visionAPI/);
  assert.match(ask,/chatAPI/);
  assert.match(functionSource('dgSubmitGuess'),/chatAPI/);
  assert.match(functionSource('dgRoleHint'),/chatAPI/);
  assert.match(guide,/action.*append或replace/);
  assert.match(guide,/换颜色/);
  assert.match(guide,/chatAPI/);
  assert.match(functionSource('dgGenerateRoleDrawing'),/mode==='photo'.*visionAPI/s);
});

test('mobile layout keeps the player below the canvas and all action buttons hittable',()=>{
  const render=functionSource('renderDrawGuess');
  assert.ok(render.indexOf('dg-canvas-shell')<render.indexOf('dg-person me'));
  assert.match(render,/type="button" class="primary" onclick="dgGuideRole\(\)"/);
  assert.match(html,/\.dg-person\.me\{margin-top:6px/);
  assert.match(html,/\.dg-rolebar\{flex-wrap:wrap/);
  assert.match(html,/touch-action:manipulation/);
  assert.match(html,/\.dg-finish button\{min-width:0/);
});

test('invites and only genuine drawing-room dialogue survive into memory',()=>{
  assert.match(app,/\[你画我猜\]/);
  assert.match(functionSource('roleGameInvite'),/role:'assistant',type:'gameinvite'/);
  assert.match(functionSource('dgRecordMemory'),/drawGuessMemory/);
  assert.match(functionSource('dgRecordMemory'),/gameSetHandoff/);
  assert.match(functionSource('dgRecordMemory'),/_dg\.dialogue/);
  assert.doesNotMatch(functionSource('dgRecordMemory'),/这一轮画的是/);
  assert.match(app,/# 你们的你画我猜画作记忆/);
  assert.match(functionSource('clearContactMemoryData'),/drawGuessMemory/);
  assert.match(html,/\.dg-invite-lines/);
});
