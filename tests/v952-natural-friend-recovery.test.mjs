import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

assert.match(source, /function friendAcceptedLocalFallback\(id,note,aid\)/);
assert.match(source, /if\(!success&&friendAcceptedAutoNote\(note\)\)success=friendAcceptedLocalFallback\(id,note,aid\)/);
assert.match(source, /catch\(e\)\{if\(typingEl\)typingEl\.remove\(\);[\s\S]*?toast\('模型未回复：'\+em,10000\);\}/);
assert.doesNotMatch(source, /pushMsg\([^\n]*content:'⚠️ '\+e\.message/);

assert.match(source, /callEligible=plan\.kind!=='photo'&&plan\.kind!=='location'&&plan\.kind!=='checkin'&&plan\.kind!=='conflict'/);
assert.doesNotMatch(source, /callEligible=!natural&&/);
assert.match(source, /function blockedPhoneStart\(c,now\)[\s\S]*?dueAt:t\+20000[\s\S]*?max:3/);
assert.match(source, /function blockedPhoneRetry\(call,why\)[\s\S]*?Date\.now\(\)\+20000/);
assert.match(source, /if\(isMain\(\)\)blockedPhoneStart\(c,now\)/);
assert.match(source, /blockedOutreach:true,attempt,maxAttempts/);

assert.match(source, /function friendRejectRemember\(c,r\)/);
assert.match(source, /function friendReqUnique\(c,text,attempt\)/);
assert.match(source, /if\(r\.kind==='readd'&&c\)\{friendRejectRemember\(c,r\)/);
assert.match(source, /s\+=_main\?friendReaddPrompt\(c\):''/);
assert.match(source, /friendReaddReplyNeedsRepair\(c,_userText,content\)/);

assert.doesNotMatch(source, /function checkFollowups\(\)\{if\(wechatNaturalOn\(\)/);
assert.doesNotMatch(source, /async function maybeFollowup\(id,text\)\{const c=getC\(id\);if\(wechatNaturalOn\(\)/);
assert.doesNotMatch(source, /async function holidayGreet\(id,hol\)\{if\(wechatNaturalOn\(\)/);
assert.doesNotMatch(source, /checkStepReport=function\(\)\{if\(wechatNaturalOn\(\)/);

console.log("v953 natural mode and friend recovery tests passed");
