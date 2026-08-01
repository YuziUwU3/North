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
  const setup=functionSource('dgOpenSetup'),start=functionSource('dgStartNew'),begin=functionSource('dgBeginState'),prepared=functionSource('dgStartPrepared'),setter=functionSource('dgSetRoomTitle'),render=functionSource('renderDrawGuess');
  assert.doesNotMatch(setup,/id="dg_topic"/,'the title must not live outside the room');
  assert.match(setup,/我来画/);
  assert.match(setup,/TA 来画/);
  assert.match(setup,/我说你画/);
  assert.doesNotMatch(setup,/dg_duration|每轮作画时间/);
  assert.doesNotMatch(start,/dgPickWord|DG_WORDS/,'new rounds must not draw from the old fixed word list');
  assert.match(start,/dgBeginState\(cid,mode\)/);
  assert.match(begin,/phase:'setup'/);
  assert.match(render,/id="dg_room_title"/);
  assert.match(setter,/mode==='role'/,'normal guessing must reject player-authored titles');
  assert.match(prepared,/g\.mode==='role'.*g\.answer=''/s,'TA-draws mode must always begin with a secret role-picked topic');
  assert.match(render,/photo&&!done\|\|setup&&meDraw/,'only player-draw and free mode expose the room title editor');
  assert.match(render,/dgUploadRoleBase\(\)/);
  assert.match(render,/dgStartPrepared\(\)/);
  assert.doesNotMatch(prepared,/mode==='photo'&&!g\.background/,'free mode must also start on a blank canvas');
  assert.match(prepared,/mode==='photo'&&!g\.answer/,'free mode still needs the player-authored title');
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
  for(const name of ['dgLine','dgEllipse','dgRotEllipse','dgRect','dgHumanizePlan','dgFallbackPlan','dgNormalizePlan'])vm.runInContext(functionSource(name),context);
  const tree=context.dgFallbackPlan('大树');
  assert.ok(tree.length>=18,'tree fallback needs trunk outlines, branches, crown clusters and ground details');
  assert.ok(tree.every(s=>s.width>=6&&s.points.length>=2));
  const dog=context.dgFallbackPlan('小狗');
  assert.ok(dog.length>=22,'dog reference needs head, muzzle, ears, body, legs, paws and tail');
  assert.ok(new Set(dog.map(s=>s.color)).size>=5,'dog reference needs readable color separation');
  const generated=functionSource('dgGenerateRoleDrawing'),animate=functionSource('dgAnimateNext');
  assert.match(generated,/完整躯干/);
  assert.match(generated,/不要从固定词库随机抽/);
  assert.match(generated,/根据你和.*真实相处/);
  assert.match(generated,/finishSpeech/,'finish dialogue is generated in the same planning call');
  assert.match(generated,/主轮廓线宽12到18/);
  assert.match(generated,/最重要的唯一标准是“像”/);
  assert.match(generated,/绝不能只画椭圆脸加一根长身体/);
  assert.match(generated,/dgReferencePlan\(g\.answer\)/,'common subjects use a recognizable local reference when available');
  assert.match(functionSource('dgNormalizePlan'),/broad\?32:20/,'hair and clothing fill strokes can cover an area');
  assert.match(animate,/drawMs/);
  assert.match(animate,/420\+/,'there is a visible human pause between strokes');
  assert.match(animate,/requestAnimationFrame/);
  assert.match(animate,/dgBrushDip/,'TA visibly visits its palette before drawing a stroke');
  assert.match(animate,/dgBrushFollow/,'the on-screen brush follows every rendered stroke');
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

test('vision is limited to player drawings or free mode and failures stay invisible',()=>{
  const ask=app.slice(app.indexOf('async function dgAskRoleGuess'),app.indexOf('function dgHintRole')),guide=functionSource('dgGuideRole');
  assert.match(functionSource('dgTimeUp'),/dgFinishDrawing/);
  assert.match(functionSource('dgTimeUp'),/phase='done'/);
  assert.match(ask,/if\(!g\.visionDesc\)/);
  assert.match(ask,/visionAPI/);
  assert.match(ask,/chatAPI/);
  assert.match(ask,/真实答案是/,'vision failure silently gives the answer to the role');
  assert.match(ask,/guess=visionFallback\?String\(g\.answer/,'the silent fallback must actually submit the known answer');
  assert.doesNotMatch(ask,/toast\(/,'vision failure must never surface a failure toast');
  assert.doesNotMatch(ask,/识图失败/,'the player must not be told that vision failed');
  assert.match(functionSource('dgSubmitGuess'),/chatAPI/);
  assert.doesNotMatch(functionSource('dgSubmitGuess'),/visionAPI/,'the role already knows its own drawing answer');
  assert.match(functionSource('dgRoleHint'),/chatAPI/);
  assert.doesNotMatch(functionSource('dgRoleHint'),/visionAPI/,'asking the role for a hint never needs vision');
  assert.doesNotMatch(functionSource('dgSendHint'),/visionAPI/,'a follow-up player hint reuses the cached first look');
  assert.match(guide,/action.*append或replace/);
  assert.match(guide,/换颜色/);
  assert.match(guide,/chatAPI/);
  assert.match(functionSource('dgGenerateRoleDrawing'),/mode==='photo'&&g\.background.*visionAPI/s);
  assert.match(functionSource('dgGenerateRoleDrawing'),/regions/);
  assert.match(functionSource('dgGenerateRoleDrawing'),/landmarks/);
  assert.match(functionSource('dgGenerateRoleDrawing'),/backgroundRect/);
  assert.match(functionSource('dgGenerateRoleDrawing'),/发际线/);
  assert.match(functionSource('dgGenerateRoleDrawing'),/不能漂浮、错位/);
  assert.match(functionSource('dgGenerateRoleDrawing'),/当前没有上传底图/);
  assert.doesNotMatch(functionSource('dgSubmitGuess'),/aiStrokeIndex</);
  assert.doesNotMatch(functionSource('dgRoleHint'),/aiStrokeIndex</);
  assert.doesNotMatch(guide,/aiStrokeIndex</);
  assert.match(guide,/g\.mode!=='photo'/,'editing is exclusive to free mode');
  assert.doesNotMatch(guide,/g\.answer=/,'free-mode revisions must keep the player-authored room title');
});

test('mobile layout keeps the player below the canvas and separates normal guessing from free editing',()=>{
  const render=functionSource('renderDrawGuess'),hint=functionSource('dgHintRole'),busyCss=html.slice(html.lastIndexOf('.dg-busy{'),html.indexOf('}',html.lastIndexOf('.dg-busy{'))+1);
  assert.ok(render.indexOf('dg-canvas-shell')<render.indexOf('dg-person me'));
  assert.match(render,/>发送<\/button>/);
  assert.doesNotMatch(render,/>发送修改<\/button>/);
  assert.doesNotMatch(render,/>发送答案<\/button>/);
  assert.match(render,/id="dg_hint_input"/);
  assert.match(render,/dgSendHint\(\)/);
  assert.match(render,/busyText=_dg\.activity\|\|'正在处理'/);
  assert.match(functionSource('dgSubmitGuess'),/activity='正在回应'/);
  assert.match(functionSource('dgRoleHint'),/activity='正在回应'/);
  assert.match(app.slice(app.indexOf('async function dgAskRoleGuess'),app.indexOf('function dgHintRole')),/activity=g\.visionDesc\?'正在猜':'正在识图'/);
  assert.doesNotMatch(hint,/openModal/,'player hints must stay inline');
  assert.doesNotMatch(render,/<time id="dgtime"/);
  assert.doesNotMatch(render,/av\(c\.avatar|av\(S\.me\.avatar/);
  assert.match(html,/\.dg-rolebar\{flex-wrap:wrap/);
  assert.match(html,/touch-action:manipulation/);
  assert.match(html,/\.dg-finish button\{min-width:0/);
  assert.match(html,/-webkit-touch-callout:none/);
  assert.match(html,/\.dg-person\.role \.dg-speech\{color:#4e84bd/);
  assert.match(html,/\.dg-person\.me \.dg-speech\{[^}]*color:#d67d9f/);
  assert.match(html,/\.dg-speech\{[^}]*background:#fff/);
  assert.match(busyCss,/left:12px/);
  assert.match(busyCss,/top:12px/);
  assert.match(busyCss,/inset:auto/);
  assert.match(busyCss,/backdrop-filter:none/);
  assert.match(html,/\.dg-hintbar\{/);
  assert.match(render,/class="dg-tools-head"/);
  assert.ok(render.indexOf('dgFinishDrawing()')<render.indexOf('dg-palette'),'finish drawing must stay above the crowded tool row');
  assert.match(html,/\.dg-tools-head\{/);
  assert.match(html,/\.dg-ai-palette\{/);
  assert.match(html,/\.dg-ai-brush\{/);
  assert.match(render,/id="dgAiBrush"/);
  assert.match(functionSource('dgMount'),/oncontextmenu/);
  assert.match(functionSource('dgMount'),/onselectstart/);
});

test('free photo continuation has no guessing and the hall usage badge stays hidden',()=>{
  const render=functionSource('renderDrawGuess'),tick=functionSource('usageTick'),next=functionSource('dgNewRound');
  assert.match(render,/photo\?'我说你画':'你画我猜'/);
  assert.match(render,/photo\?`<button[^`]+>发送<\/button>`/);
  assert.doesNotMatch(render,/photo\?`[^`]*提交答案/s);
  assert.match(functionSource('dgGenerateRoleDrawing'),/activity=g\.mode==='photo'&&g\.background\?'正在识图并构思':'正在构思'/);
  assert.match(tick,/cur\(\)\.p==='drawguess'\?'none':'block'/);
  assert.match(next,/dgOpenSetup\(cid\)/,'a new round must reopen the three-mode chooser');
  assert.doesNotMatch(next,/mode=_dg\.mode|dgBeginState\(cid,mode\)/);
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

test('configured role drawing uses one generated image and reveals it without vision',()=>{
  const generate=functionSource('dgGenerateRoleDrawing');
  const art=functionSource('dgGenerateArt');
  const reveal=functionSource('dgRevealPlan');
  const animate=functionSource('dgAnimateNext');
  const snapshot=functionSource('dgSnapshotData');
  assert.match(generate,/g\.mode==='role'&&dgImageConfigured\(\)/);
  assert.match(generate,/await dgGenerateArt\(g\.answer,g\.instruction\)/);
  assert.match(generate,/g\.plan=dgRevealPlan\(\)/);
  assert.doesNotMatch(generate,/g\.mode==='role'.*visionAPI/);
  assert.match(art,/source:'draw_guess'/);
  assert.match(art,/imageGenerateExternal/);
  assert.doesNotMatch(art,/visionAPI/);
  assert.match(reveal,/reveal:true/);
  assert.match(animate,/s\.reveal/);
  assert.doesNotMatch(animate,/imageGenerateExternal|aiRelay|visionAPI/);
  assert.match(snapshot,/g\.generatedArt/);
  assert.match(snapshot,/filter\(s=>!s\.reveal\)/);
});

test('game hall drawing draft reopens the mode chooser directly',()=>{
  const hub=functionSource('renderGameHub');
  assert.match(hub,/继续画作/);
  assert.match(hub,/dgOpenSetup\('\$\{d\.cid\}'\)/);
  assert.match(hub,/可继续或重新选择/);
});
