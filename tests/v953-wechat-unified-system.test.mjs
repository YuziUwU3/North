import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const project=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj',import.meta.url),'utf8');

assert.match(source,/APP_VER='v956 · 安卓首页与设置绘制稳定性修复'/);
assert.match(html,/__NORTH_SHELL_BUILD__='956'/);
assert.match(sw,/BUILD='956'/);
assert.equal((project.match(/CURRENT_PROJECT_VERSION = 78;/g)||[]).length,12);
assert.equal((project.match(/MARKETING_VERSION = 1\.0\.78;/g)||[]).length,12);

assert.match(source,/const WECHAT_UNIFIED_SYSTEM=true/);
assert.match(source,/function wechatNaturalOn\(\)\{return WECHAT_UNIFIED_SYSTEM;\}/);
assert.doesNotMatch(source,/wechatNatural:false/);
assert.doesNotMatch(source,/微信自然模式（测试）/);
assert.doesNotMatch(source,/settings\.wechatNatural/);
assert.doesNotMatch(source,/id="s_natural"/);

assert.match(source,/if\(got\)suspicionOnAssistantReply\(c\)/);
assert.match(source,/dialogueEmotionOnReply\(c,content,_userText\)/);
assert.match(source,/maybeAffectionShift\(id,c,_lu,content\)/);
assert.match(source,/const plan=initiativePlan\(c,a,st\)/);

// The unified default intentionally keeps the two most mechanical systems out.
assert.match(source,/if\(!wechatNaturalOn\(\)\)maybeGrudgeResolve/);
assert.match(source,/if\(_main&&!_natural&&!opt\.selectiveMemory\)/);

console.log('v956 WeChat unified system tests passed');
