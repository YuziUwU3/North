import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const root=process.cwd();
const bundle='native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle';
const read=p=>fs.readFileSync(`${root}/${p}`,'utf8');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(`${root}/${p}`)).digest('hex');

test('Chinese ceremony ships six selected previews, certificate art and its own looping music',()=>{
  const files=['01-sedan-curtain.png','02-embroidered-ball.png','03-bow-heaven-earth.png','04-couple-bow.png','05-formal-toast.png','06-veil-lift.png','certificate-blank.png','chinese-wedding-theme.mp3'];
  for(const file of files){
    const source=`assets/wedding/chinese-v1/${file}`;
    assert.ok(fs.statSync(`${root}/${source}`).size>500_000);
    assert.equal(hash(source),hash(`${bundle}/${source}`));
  }
  const js=read('wedding-game.js');
  assert.match(js,/const WEDDING_CHINESE_BGM=WEDDING_CHINESE_ASSET_BASE\+'chinese-wedding-theme\.mp3'/);
  assert.match(js,/function weddingBgm\(style\)/);
  assert.match(js,/a\.loop=true/);
});

test('Chinese character art uses persona-aware black or white ancient long hair, crown and one red groom robe',()=>{
  const js=read('wedding-game.js');
  assert.match(js,/weddingChineseHairColor/);
  assert.match(js,/白毛\|银毛/);
  assert.match(js,/人设明确写白发、银发或银白发才使用白色，否则默认黑色/);
  assert.match(js,/固定红色中式新郎喜服/);
  assert.match(js,/严禁短发、现代发型、与人设冲突的发色和现代西装/);
  assert.match(js,/不同角色可拥有不同长发造型和不同脸/);
  assert.match(js,/同一场六幕的具体束发结构、刘海分缝、发色、发冠造型必须完全一致/);
  assert.match(js,/具体脸型、五官比例、刘海分缝、束发结构、每一缕长发、发色、发冠外形与喜服纹样必须一模一样/);
});

test('every failed Chinese frame retries twice against a successful identity frame before preview fallback',()=>{
  const js=read('wedding-game.js');
  const prepare=js.slice(js.indexOf('async function weddingPrepareInvitation'),js.indexOf('async function weddingLoadPreparedScenes'));
  assert.match(prepare,/const failed=order\.filter/);
  assert.match(prepare,/for\(let i=0;i<failed\.length;i\+\+\)/);
  assert.match(prepare,/weddingIdentityReference\(scene,style\)/);
  assert.match(prepare,/await weddingRetryFailedScene\(c,scene,script\.formalwear,style\)/);
  assert.match(js,/for\(let attempt=1;attempt<=2;attempt\+\+\)/);
  assert.match(js,/weddingTimed\(weddingRetryFailedSceneBase\(c,scene,formalwear,style\),120000/);
  assert.match(js,/第一张输入图是同一场婚礼已经通过复核的身份参考/);
  assert.match(js,/W\.sceneImages\[scene\]=weddingScenes\(style\)\[scene\]/);
});

test('Chinese ritual holds the side bow through heaven and parents, then changes for couple bow',()=>{
  const js=read('wedding-game.js');
  const items=js.slice(js.indexOf('function weddingBuildItems'),js.indexOf('function weddingCurrent'));
  assert.match(items,/scene:'bow',speaker:'司礼',text:'一拜天地——'/);
  assert.match(items,/scene:'bow',speaker:'司礼',text:'二拜高堂——'/);
  assert.match(items,/scene:'couple',speaker:'司礼',text:'夫妻对拜——'/);
  assert.ok(items.indexOf("text:'一拜天地——'")<items.indexOf("text:'二拜高堂——'"));
  assert.ok(items.indexOf("text:'二拜高堂——'")<items.indexOf("text:'夫妻对拜——'"));
});

test('both entry and simulation explicitly offer modern and Chinese ceremonies',()=>{
  const js=read('wedding-game.js');
  assert.match(js,/模拟现代/);
  assert.match(js,/模拟中式/);
  assert.match(js,/后台准备现代/);
  assert.match(js,/后台准备中式/);
  assert.match(js,/weddingChooseInvitationStyle\([^}]*m\.style=weddingStyleKey\(style\)/);
  assert.match(js,/<b>中式<\/b><span>十里红妆<\/span>/);
  assert.doesNotMatch(js,/中式婚礼入口已经为你保留，将在下一阶段开放/);
});

test('Chinese waiting and ready invitation cards are red glass cards',()=>{
  const js=read('wedding-game.js'),css=read('wedding-game.css');
  assert.match(js,/theme=style==='chinese'\?' wedding-invite-mini-chinese'/);
  assert.match(js,/红色':'白色/);
  assert.match(css,/\.wedding-invite-mini-chinese\{/);
  assert.match(css,/backdrop-filter:blur\(18px\)/);
  assert.match(css,/linear-gradient\(142deg,rgba\(139,18,25/);
});

test('name card precedes either ceremony and certificate transition is staged',()=>{
  const js=read('wedding-game.js'),css=read('wedding-game.css');
  assert.match(js,/function weddingShowNameCard\(c\)/);
  assert.match(js,/id="weddingBrideName"/);
  assert.match(js,/id="weddingGroomName"/);
  assert.match(js,/function weddingBeginCeremony\(\)/);
  assert.match(js,/weddingShowNameCard\(c\);/);
  assert.match(js,/function weddingTransitionToCertificate\(\)/);
  assert.match(js,/setTimeout\(\(\)=>\{W\.busy=false;weddingFinish\(\);\},1850\)/);
  assert.match(css,/\.wedding-certificate-transition/);
  assert.match(css,/@keyframes wedding-cert-reveal/);
});

test('dialog and choice cards keep one fixed height',()=>{
  const css=read('wedding-game.css');
  assert.match(css,/\.wedding-dialog-host\{height:168px;min-height:168px;max-height:168px\}/);
  assert.match(css,/\.wedding-dialog\{box-sizing:border-box;height:168px!important;min-height:168px!important;max-height:168px!important\}/);
  assert.match(css,/\.wedding-action,\.wedding-choice\{height:46px;min-height:46px;max-height:46px/);
  assert.match(css,/-webkit-line-clamp:4/);
  assert.match(css,/overflow:hidden!important/);
});

test('both ceremonies lock narration and let the model generate only role speech',()=>{
  const js=read('wedding-game.js');
  assert.match(js,/function weddingFixedNarrations\(style\)/);
  assert.match(js,/fixed=weddingFixedNarrations\('modern'\)/);
  assert.match(js,/fixed=weddingFixedNarrations\('chinese'\)/);
  assert.match(js,/旁白、司礼词和问题已经固定/);
  assert.match(js,/不要输出 narration、prompt 或 officiant 字段/);
  assert.match(js,/text:weddingSafeText\(list\[i\]&&list\[i\]\.text,fallback\[i\]\.text,28\)/);
  assert.match(js,/不得串位或重复/);
  assert.equal((js.match(/\{aux:false,max:/g)||[]).length,5,'婚礼首邀、到点邀约、两种婚礼台词和婚后消息都固定走主模型');
  assert.doesNotMatch(js,/gameUseAux/);
});

test('Chinese certificate and memory remain separate from modern',()=>{
  const js=read('wedding-game.js'),css=read('wedding-game.css');
  assert.match(js,/function weddingChineseCertificateCard/);
  assert.match(js,/一拜天地、二拜高堂与夫妻对拜/);
  assert.match(js,/用喜秤为她挑起红盖头/);
  assert.match(js,/\(x\.style\|\|'modern'\)!==style/);
  assert.match(js,/id:'wed_'\+style\+'_'\+weddingHash\(c\.id\)/);
  assert.match(js,/function weddingCompletedStyles\(c\)/);
  assert.match(js,/我知道我们已经举行过现代与中式两场现实婚礼/);
  assert.match(css,/certificate-blank\.png/);
  assert.match(css,/\.wedding-cert-card-chinese/);
  assert.match(js,/<h2><span>婚<\/span><span>书<\/span><\/h2>/);
  assert.match(js,/function weddingChineseCertificateDate\(value\)/);
  assert.match(js,/class="wedding-chinese-meta"/);
  assert.match(js,/class="wedding-chinese-personal"/);
  assert.doesNotMatch(js,/class="wedding-chinese-vow">/);
  assert.doesNotMatch(js,/class="wedding-chinese-names">/);
  assert.match(css,/right:5\.1%;top:16%/);
  assert.match(css,/writing-mode:vertical-rl/);
  assert.match(css,/\.wedding-chinese-meta p b\{text-orientation:upright;letter-spacing:\.08em\}/);
});
