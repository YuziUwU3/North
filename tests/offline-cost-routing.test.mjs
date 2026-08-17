import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

assert.match(source, /function offlineHistoryMessages\(o,limit,opt\)[\s\S]*?return out\.slice\(-Math\.max\(1,limit\|0\)\)/);
assert.match(source, /text:text\.slice\(0,320\)/);
assert.match(source, /function offlinePickRelevant\(rows,query,recent,max,textOf\)/);
assert.match(source, /filter\(x=>x&&x\.text&&!x\.offlineId\)/);
assert.match(source, /offlinePickRelevant\(o\.memory\|\|\[\],query,3,6,offMemText\)/);
assert.match(source, /function offlineRepairMessages\(c,o,turn,candidate,repair\)[\s\S]*?offlineHistoryMessages\(o,10,\{deferCurrent:true\}\)/);
assert.match(source, /let r=roleVisibleEnvelopeText\(await chatAPI\(req,\{aux:false,max:replyMax,temp:\.75\}\)\)/);
assert.match(source, /chatAPI\(offlineRepairMessages\(c,o,turn,r,offlineRoleRepairPrompt\(c,r\)\),\{aux:true,max:replyMax,temp:\.72\}\)/);
assert.match(source, /chatAPI\(offlineRepairMessages\(c,o,turn,r,offlineRepeatRepairNote\(c,repeats\)\),\{aux:true,max:replyMax,temp:\.78\}\)/);
assert.match(source, /function offlineReplyBudget\(input\)[\s\S]*?700[\s\S]*?650[\s\S]*?600/);
assert.match(source, /单次约会保留原规则：正常回复用主模型、纠错优先副模型/);

console.log('offline date cost routing tests passed');
