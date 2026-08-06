import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const effect=readFileSync(join(root,'gift-effects.js'),'utf8');
const app=readFileSync(join(root,'app.js'),'utf8');
const html=readFileSync(join(root,'小手机.html'),'utf8');
const preview=readFileSync(join(root,'gift-flower-preview.html'),'utf8');
const sw=readFileSync(join(root,'sw.js'),'utf8');

test('supported particle gifts open from received role gift cards',()=>{
  for(const name of ['花束','玫瑰','百合','郁金香','向日葵','满天星','永生花'])assert.match(app,new RegExp(name));
  assert.match(app,/function giftNameIsFloral/);
  assert.match(app,/function giftEffectKind/);
  assert.match(app,/function giftMessageBloom/);
  assert.match(app,/found\.from!=='ta'/,'outgoing gifts must not masquerade as received flower effects');
  assert.match(app,/giftcard giftcard-effect giftcard-simple/);
  assert.match(app,/function giftBoxCardArt/,'formal role cards should render only the chosen minimal Moonlight box and text');
  assert.match(app,/pend=\(m\.from==='ta'.+&&!effect\)/,'particle gift cards must not show receive or reject preview controls');
  assert.match(app,/function giftMessageOpen/);
  assert.match(app,/giftMessageBloom\(mid\);\},880\)/,'role gift cards must shake before opening');
  assert.match(effect,/@keyframes giftCardShake/);
  assert.doesNotMatch(effect,/content:'点击开启'/,'the formal role card should not add a pseudo-button');
});

test('mail signing opens the saved flower, toy or ring recipe without changing delivery logic',()=>{
  assert.match(app,/effect=L\.kind==='gift'&&giftEffectKind\(L\.giftName\)/);
  assert.match(app,/setTimeout\(\(\)=>playGiftRecipe\(L\.giftName/);
  assert.match(app,/scheduleReply\(L\.cid/,'the existing role acknowledgement remains intact');
});

test('bouquet composition is constrained-random rather than one fixed drawing',()=>{
  assert.match(effect,/const PALETTES=\[/);
  assert.match(effect,/FLOWER_TYPES=\['rose','daisy','peony'\]/);
  assert.match(effect,/const flowerCount=\(reduced\?7:9\)\+Math\.floor/);
  assert.match(effect,/anchors=\[/,'flowers should keep a bouquet silhouette while positions vary');
  assert.match(effect,/seededRandom\(seed\)/);
  assert.match(effect,/palette:palette\.name/);
});

test('the chosen flower, meaning and date persist as role-readable gift facts',()=>{
  assert.match(effect,/const FLOWER_RECIPES=\[/);
  assert.match(effect,/function createBouquetRecipe/);
  assert.match(effect,/flowerMeaning:chosen\.meaning/);
  assert.match(effect,/meaning\.textContent='花语 · '/);
  assert.match(effect,/detail\.textContent=safeLabel\(options\.sender,'TA'\)\+' 赠予 · '\+recipe\.date/);
  assert.match(app,/giftRecipe:opts\.giftRecipe\|\|null/,'parcel must retain the exact generated recipe');
  assert.match(app,/giftRecipe:g\.giftRecipe\|\|null/,'mail delivery must retain the exact generated recipe');
  assert.match(app,/function giftRecipeContext/,'role history must serialize the exact generated gift fact');
  assert.match(app,/以后提起必须和这次已经确定的礼物一致/,'the signing acknowledgement must pin the role to the saved gift');
});

test('holidays and anniversaries automatically give the couple one autonomous gift choice',()=>{
  assert.match(app,/function occasionGift/);
  assert.match(app,/gift_hol_/);
  assert.match(app,/三类中必须且只能选一类/);
  assert.match(app,/\[送礼\|一束鲜花\|0\|/);
  assert.match(app,/\[送礼\|玩偶礼物\|0\|/);
  assert.match(app,/\[送礼\|订婚戒指\|0\|/);
  assert.match(app,/giftEffectRecipe\(name,null,giftId,giftTime,words\)/,'the role note must persist into the chosen particle recipe');
  for(const color of ['blue','pink','white','red'])assert.match(app,new RegExp(color+":'#"));
});

test('teddy and engagement-ring previews use bounded particle recipes with words and dates',()=>{
  assert.match(effect,/const TEDDY_RECIPES=\[/);
  assert.match(effect,/const RING_RECIPES=\[/);
  for(const species of ['bear','rabbit','puppy','kitten'])assert.match(effect,new RegExp("species:'"+species+"'"));
  for(const style of ['round','halo','heart','pear'])assert.match(effect,new RegExp("style:'"+style+"'"));
  assert.match(effect,/function buildTeddyTargets/);
  assert.match(effect,/function buildRingTargets/);
  assert.match(effect,/lastCollectibleId=\{teddy:'',ring:''\}/,'consecutive previews should not immediately repeat');
  assert.match(effect,/74\*s,74\*s/,'the engagement ring should use a compact round band');
  assert.match(effect,/global\.playTeddyGiftEffect/);
  assert.match(effect,/global\.playRingGiftEffect/);
  assert.match(effect,/bottom:max\(8px,calc\(env\(safe-area-inset-bottom\) \+ 4px\)\)/,'gift copy must stay below the generated object');
  assert.match(preview,/data-kind="teddy">玩偶礼物/);
  assert.match(preview,/data-kind="ring">订婚戒指/);
});

test('full-screen particle animation is mobile-bounded and cleans itself up',()=>{
  assert.match(effect,/requestAnimationFrame\(draw\)/);
  assert.match(effect,/Math\.min\(global\.devicePixelRatio\|\|1,1\.75\)/,'retina resolution must be capped for mobile stability');
  assert.match(effect,/prefers-reduced-motion: reduce/);
  assert.match(effect,/document\.hidden\)stop\(true\)/);
  assert.match(effect,/cancelAnimationFrame\(frame\)/);
  assert.match(effect,/overlay\.remove\(\)/);
  assert.match(effect,/position:fixed;inset:0;z-index:2147483000/);
});

test('the app, offline cache and gate-free preview all load the effect',()=>{
  assert.match(html,/gift-effects\.js\?v=829/);
  assert.match(sw,/gift-effects\.js\?v='\+BUILD/);
  assert.match(preview,/gift-effects\.js\?v=preview-1/);
  assert.match(preview,/class="gift-cover"/);
  assert.match(preview,/id="giftNameCn">一束鲜花</);
  assert.match(preview,/id="giftNameEn">A BOUQUET OF FLOWERS</);
  assert.match(preview,/class="box-variant variant-b"/,'the chosen Moonlight structure should be the only box geometry');
  assert.doesNotMatch(preview,/variant-[acd]/);
  for(const color of ['blue','pink','white','red'])assert.match(preview,new RegExp('data-box-choice="'+color+'"'));
  assert.match(preview,/background:color-mix\(in srgb,var\(--line\) 84%,white\)/,'surrounding stars must follow the selected box color');
  assert.doesNotMatch(preview,/M142 113l-25 47/,'the lower bow tails must be removed to prevent clipping');
  assert.match(preview,/@keyframes giftShake/);
  assert.match(preview,/classList\.add\('opening'\)/);
  assert.match(effect,/english\.textContent=recipe\.enName/);
  assert.doesNotMatch(preview,/花材、配色|连续查看|看看蓝色花束|本地预览分支/);
});
