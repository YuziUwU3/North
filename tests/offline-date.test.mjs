import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "小手机.html"), "utf8");

assert.match(source, /v550 · 线下约会沉浸防跳戏/);
assert.match(source, /function offlineRoleGuard\(c\)/);
assert.match(source, /线下约会沉浸铁律（最高优先级）/);
assert.match(source, /function offlineRoleDrift\(t\)/);
assert.match(source, /for\(let _ra=0;_ra<2&&offlineRoleDrift\(r\)/);
assert.match(source, /m\.who==='旁白'&&m\.source==='me'/);
assert.match(source, /who:'旁白',source:'me',text:v/);

assert.match(source, /function offClearMemory\(id\)/);
assert.match(source, /o\.memory=\[\];o\.history=\[\];o\.previousEndedAt=0/);
assert.match(source, /x&&x\.offlineId/);
assert.match(source, /function offPreviousPrompt\(o\)/);
assert.match(source, /上一场约会结束于/);
assert.match(source, /不能延续上一场最后的姿势、房间、动作或未说完的现场台词/);
assert.match(source, /function renderOffIntro\(c,o\)/);
assert.match(source, /进入这场约会/);

assert.match(source, /function offlineFocusActive\(\)/);
assert.match(source, /async function aiReply\(id,note,replyToken\)\{if\(offlineFocusActive\(\)\)return/);
assert.match(source, /function scheduleReply\(id,note\)\{\s*if\(offlineFocusActive\(\)\)return/);
assert.match(source, /function incomingCall\(id,kind\)\{if\(offlineFocusActive\(\)\)return/);
assert.match(source, /async function aiGroupReply\(id,fromText\)\{if\(offlineFocusActive\(\)\)return/);
assert.match(source, /if\(offlineFocusActive\(\)\)\{if\(typingEl&&typingEl\.isConnected\)typingEl\.remove\(\);return;\}/);

assert.match(html, /\.offstage\{/);
assert.match(html, /\.offintro\{/);
assert.match(html, /\.offmsg\.them \.offbubble\{/);
assert.match(html, /\.offmsg\.me \.offbubble\{/);
assert.match(html, /app\.js\?v=550/);

console.log("offline date tests passed");
