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

test('game hall is a real app page with draw-and-guess as the featured game',()=>{
  assert.match(app,/\{k:'drawguess',e:'',n:'你画我猜'/);
  assert.match(app,/else if\(c\.p==='gameshub'\)html=renderGameHub\(\)/);
  assert.match(app,/else if\(c\.p==='drawguess'\)html=renderDrawGuess\(\)/);
  assert.match(functionSource('renderGameHub'),/全部游戏/);
  assert.match(functionSource('renderGameHub'),/我的画作/);
  assert.match(functionSource('startGame'),/k==='drawguess'/);
  assert.match(html,/\.gamehub-grid/);
  assert.match(html,/\.dg-canvas-shell/);
});

test('drawing canvas supports thick pencil controls, undo, upload, save and delete',()=>{
  const render=functionSource('renderDrawGuess');
  assert.match(render,/相册底图/);
  assert.match(render,/撤回一笔/);
  assert.match(render,/清空画布/);
  assert.match(render,/dgSetWidth\(13,this\)/,'reference-style medium thick pencil is the default');
  assert.match(render,/保存画作/);
  assert.match(functionSource('dgArchive'),/gallery\.unshift/);
  assert.match(functionSource('dgDeleteArtwork'),/gallery=x\.gallery\.filter/);
  assert.match(functionSource('dgUploadBase'),/background=src/);
  assert.match(functionSource('dgUndo'),/strokes\.pop\(\)/);
});

test('role drawing uses vector strokes and falls back to built-in cute sketches without image generation',()=>{
  const context=vm.createContext({Math});
  for(const name of ['dgLine','dgEllipse','dgRect','dgFallbackPlan','dgNormalizePlan'])vm.runInContext(functionSource(name),context);
  for(const word of ['太阳','房子','小猫','雨伞','苹果','小鱼','汽车','花朵','眼镜','杯子','蝴蝶','雪人','闹钟','大树','月亮','蛋糕']){
    const strokes=context.dgFallbackPlan(word);
    assert.ok(strokes.length>=3,`${word} needs a usable fallback drawing`);
    assert.ok(strokes.every(s=>s.width>=10&&s.points.length>=2),`${word} keeps rounded thick strokes`);
  }
  const generated=functionSource('dgGenerateRoleDrawing');
  assert.match(generated,/可爱简笔画/);
  assert.match(generated,/深灰粗圆轮廓/);
  assert.doesNotMatch(generated,/imageAPI|aiImage|生图/);
  assert.match(functionSource('dgAnimateNext'),/requestAnimationFrame/);
});

test('both guessing directions, timer, hints and one-pass vision reuse are wired',()=>{
  const ask=app.slice(app.indexOf('async function dgAskRoleGuess'),app.indexOf('function dgHintRole'));
  assert.match(functionSource('dgTimeUp'),/dgFinishDrawing/);
  assert.match(functionSource('dgTimeUp'),/画布还是空的/,'an empty timed round must not become a stuck guessing state');
  assert.match(ask,/visionAPI/);
  assert.match(ask,/if\(!g\.visionDesc\)/);
  assert.match(ask,/chatAPI/,'later hints reuse the first vision description');
  assert.match(functionSource('dgHintRole'),/给TA一点提示/);
  assert.match(functionSource('dgRoleHint'),/第一个字/);
  assert.match(functionSource('dgSubmitGuess'),/dgCorrect/);
});

test('invites and completed drawing memories survive outside the room',()=>{
  assert.match(app,/\[你画我猜\]/);
  assert.match(functionSource('roleGameInvite'),/role:'assistant',type:'gameinvite'/);
  assert.match(functionSource('roleGameInviteDecide'),/status!=='pending'/);
  assert.match(functionSource('dgRecordMemory'),/drawGuessMemory/);
  assert.match(functionSource('dgRecordMemory'),/gameSetHandoff/);
  assert.match(app,/# 你们的你画我猜画作记忆/);
  assert.match(functionSource('clearContactMemoryData'),/drawGuessMemory/);
  assert.match(html,/\.dg-invite-lines/,'invitation uses a line-art card');
});
