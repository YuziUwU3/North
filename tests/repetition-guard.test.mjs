import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

assert.match(source, /# 今天的任务便签（只作状态背景，不是每轮必聊话题）/);
assert.match(source, /本轮没有在谈任务，不要主动把话题拉回任务/);
assert.match(source, /近期已经问过或催过任务/);
assert.match(source, /function hlRoutineRepeatFails\(content,c,userText,p\)/);
assert.match(source, /_repeat=.*\/重复\|近期已经聊过\//);
assert.match(source, /currentText:note\|\|_userText/);
assert.doesNotMatch(source, /可以自然地催ta、验收、点评/);

const start = source.indexOf("const HL_ROUTINE_TOPICS=");
const end = source.indexOf("function bdsmKnowledgeFails", start);
assert.ok(start >= 0 && end > start);

const messages = [
  { role: "assistant", type: "text", content: "我给你的任务做完了吗？" },
  { role: "assistant", type: "text", content: "晚饭吃过没有？" },
];
const sandbox = {
  msgs() { return messages; },
  hlVisibleLines(text) { return String(text).split("\n").filter(Boolean); },
};
vm.runInNewContext(
  source.slice(start, end) +
    ";globalThis.taskRepeat=hlRoutineRepeatFails('今天的任务完成没有？',{id:'c1'},'我刚看到一部电影',{source:'我刚看到一部电影'});" +
    "globalThis.mealRepeat=hlRoutineRepeatFails('记得去吃晚饭',{id:'c1'},'我在看电影',{source:'我在看电影'});" +
    "globalThis.userRaisedTask=hlRoutineRepeatFails('还差两条任务',{id:'c1'},'我的任务还差多少',{source:'我的任务还差多少'});" +
    "globalThis.freshTopic=hlRoutineRepeatFails('这部电影哪里最好看？',{id:'c1'},'我在看电影',{source:'我在看电影'});",
  sandbox,
);

assert.match(sandbox.taskRepeat.join(" "), /任务/);
assert.match(sandbox.mealRepeat.join(" "), /吃饭/);
assert.deepEqual(Array.from(sandbox.userRaisedTask), []);
assert.deepEqual(Array.from(sandbox.freshTopic), []);

console.log("repetition guard tests passed");
