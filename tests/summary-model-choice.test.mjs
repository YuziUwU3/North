import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert.match(source, /summaryModel:'main', offSummaryModel:'main'/);
assert.match(source, /id="s_summarymodel"/);
assert.match(source, /id="s_offsummarymodel"/);
assert.match(source, /\u5fae\u4fe1\u81ea\u52a8\u603b\u7ed3\u6a21\u578b/);
assert.match(source, /\u7ebf\u4e0b\u7ea6\u4f1a\u603b\u7ed3\u6a21\u578b/);
assert.match(source, /\{aux:S\.settings\.summaryModel==='aux',max:460,temp:\.3,complete:true\}/);
assert.match(source, /const useAux=S\.settings\.offSummaryModel==='aux'/);
assert.match(source, /max=Math\.min\(cp\.tokens,2200\)/);
assert.match(source, /\{aux:useAux,max,temp:\.12\}/);
assert.match(source, /full=offSummaryTranscript\(ended,c\),chunks=offSummaryChunks\(full,5600\)/);
assert.match(source, /\{aux:useAux,max,temp:\.06\}/);
assert.match(source, /offSummaryVerifyDrafts\(drafts\.slice\(0,plan\.maxPoints\),ended,c,useAux\)/);
assert.match(source, /S\.settings\.offSummaryModel=this\.value;save\(\);offMemory/);
assert.match(source, /S\.settings\.summaryModel=this\.value;save\(\);editSummary/);

console.log("summary model choice tests passed");
