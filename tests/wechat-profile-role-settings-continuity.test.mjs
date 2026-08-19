import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../小手机.html',import.meta.url),'utf8');

test('the four WeChat-style role pages have independent clickable routes',()=>{
  for(const name of ['renderContactInfo','renderFriendInfo','renderContactSettings','renderRoleMoments'])assert.match(app,new RegExp(`function ${name}\\(id\\)`));
  for(const route of ['friendInfo','contactSettings','roleMoments','roleFeatures'])assert.match(app,new RegExp(`c\\.p==='${route}'`));
  for(const preview of ['wechat-profile','wechat-friend-info','wechat-contact-settings','wechat-role-moments'])assert.match(app,new RegExp(preview));
  assert.match(html,/\.wx-real-profile/);
  assert.match(html,/\.wx-subpage/);
  assert.match(html,/\.wx-role-moments/);
});

test('proactive interval is stored and scheduled per role instead of globally',()=>{
  assert.match(app,/proactiveIdlePerRoleV1/);
  assert.match(app,/c\.proactive\.idleMin/);
  assert.match(app,/id="pa_idle"/);
  assert.match(app,/function saveProactiveIdle\(id\)/);
  assert.match(app,/initiativeConfiguredIntervalMs\(c\)/);
  assert.match(app,/idleMinutes:configured/);
  assert.doesNotMatch(app,/id="s_pidle"/);
});

test('an explicit arrival updates common-life status during the same chat turn',()=>{
  assert.match(app,/doorOpened=.*faceToFace=/);
  assert.match(app,/arrived=explicit\|\|doorOpened&&faceToFace/);
  assert.match(app,/source:'wechat-natural-arrival'/);
  assert.match(app,/activity:'在家',place:'玄关'/);
  assert.match(app,/stateSource&&d\.stateSource!=='schedule-auto'/);
});

test('remote facts distinguish the controlling role from the phone owner',()=>{
  assert.match(app,/你（'\+actorName\+'本人）/);
  assert.match(app,/手机主人「'\+S\.me\.name\+'」（不是你）/);
  assert.match(app,/actorOwn:x\.authorId===actorId/);
  assert.match(app,/actorOwn:x\.who===actorId/);
  assert.match(app,/本次远程操控的原始目标，执行中不得忘记/);
});

test('role profile visuals use centered vector gender and real image-only previews',()=>{
  assert.match(app,/function contactGenderIcon\(gender\)/);
  assert.match(app,/contactGenderIcon\(c\.gender\)/);
  assert.match(app,/function contactMomentThumbs\(c\)[\s\S]*?return out;/);
  assert.doesNotMatch(app,/function contactMomentThumbs\(c\)[^\n]*out\.push\(''\)/);
  assert.doesNotMatch(app,/moment-text-art/);
  assert.match(html,/\.wx-profile-hero\{[^}]*padding:34px 22px 30px/);
  assert.match(html,/\.wx-role-cover \.avatar\.lg\{[^}]*aspect-ratio:1\/1/);
});

test('role feature settings expose five direct categories with calls separated',()=>{
  assert.match(app,/function renderRoleManagementAll\(id\)/);
  assert.match(app,/function renderRoleManagement\(id,group\)/);
  for(const group of ['profile','chat','calls','publish','privacy'])assert.match(app,new RegExp(`group:'${group}'`));
  for(const label of ['资料、记忆与外观','聊天与主动联系','通话与通话记录','朋友圈与 X 发布','隐私、查岗与数据'])assert.match(app,new RegExp(label));
  assert.doesNotMatch(app,/设置角色权限与功能/);
  for(const control of ['editMemory','saveProactiveIdle','saveSpy','clearHistory'])assert.match(app,new RegExp(control));
  assert.match(html,/\.role-setting-direct/);
});

test('friend added date follows couple date or a stable editable fallback',()=>{
  assert.match(app,/function contactAddedDateKey\(c\)/);
  assert.match(app,/S\.couple&&S\.couple\.cid===c\.id/);
  assert.match(app,/c\.friendAddedDate/);
  assert.match(app,/function contactAddedDateEdit\(id\)/);
  assert.match(app,/相恋日期/);
});

test('role moments use a dated timeline, full detail route, and can inherit the requested chat image',()=>{
  assert.match(app,/c\.p==='roleMomentDetail'/);
  assert.match(app,/function renderRoleMomentDetail\(id,pid\)/);
  assert.match(app,/function roleMomentTimeline\(c,rows\)/);
  assert.match(app,/发布于 \$\{fmtDT\(p\.time\)\}/);
  assert.match(app,/function roleMomentRequestedUserImage\(c,opt\)/);
  assert.match(app,/opt\.images=\[src\]/);
  assert.match(app,/consumeMomentCommands\(content,c,\{toast:true,userText:_userText\}\)/);
  assert.match(html,/\.wx-role-detail\{/);
  assert.match(html,/\.wx-role-moment-card \.moment-main>img/);
});

test('moments interactions are direct, shared, removable only by the author, and always receive a role reply',()=>{
  assert.match(app,/function toggleMomentLike\(pid\)/);
  assert.match(app,/p\.likes\.splice\(i,1\)/);
  assert.match(app,/function momentCommentFocus\(pid,replyName,targetCid\)/);
  assert.match(app,/function momentCommentSubmit\(pid,inputId\)/);
  assert.match(app,/p\.authorId!==['"]me['"]/);
  assert.match(app,/replyToId:mine\.id/);
  assert.match(app,/momentReplyFallback\(c,mine\.text\)/);
  assert.doesNotMatch(app,/function momentMenu\(pid\)[\s\S]{0,400}openModal/);
  assert.match(html,/\.moment-inline-compose/);
  assert.match(html,/\.wx-role-moment-card\{[^}]*background:#19191b/);
});

test('explicit role moment pictures prefer the supplied image and otherwise generate with one retry',()=>{
  assert.match(app,/function roleMomentImageRequest\(opt\)/);
  assert.match(app,/function roleMomentRequestedUserImage\(c,opt\)/);
  assert.match(app,/if\(opt\.images&&opt\.images\.length\)return publishRoleMoment/);
  assert.match(app,/for\(let attempt=0;attempt<2;attempt\+\+\)/);
  assert.match(app,/系统会按ta描述的场景生成配图/);
});
