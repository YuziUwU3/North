import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert.match(source, /function pickFiles\(accept,cb\)[\s\S]*?i\.multiple=true/);
assert.match(source, /function addStickersBatch\(\)/);
assert.match(source, /function openStickerBatchImport\(\)/);
assert.match(source, /一键上传表情包/);
assert.match(source, /点击或拖拽上传表情包/);
assert.match(source, /支持 JPG、PNG、GIF/);
assert.match(source, /从图床网址批量添加/);
assert.match(source, /导入预览/);
assert.match(source, /可直接改含义/);
assert.match(source, /一键导入/);
assert.match(source, /function addStickerLinks\(\)/);
assert.match(source, /function normalizeStickerUrl\(url\)/);
assert.match(source, /u\.protocol==='http:'\|\|u\.protocol==='https:'\?u\.href:''/);
assert.match(source, /function parseStickerImportLine\(line\)/);
assert.match(source, /function parseStickerImportText\(raw\)/);
assert.match(source, /before\|\|after\|\|stickerUrlName\(img\)/);
assert.match(source, /function stickerBatchDrop\(e\)/);
assert.match(source, /function stickerBatchSetMeaning\(i,value\)/);
assert.match(source, /function commitStickerBatchImport\(\)/);
assert.match(source, /slice\(0,100\)/);
assert.match(source, /const seen=new Set\(S\.me\.stickers\.map\(s=>s\.img\)\)/);
assert.match(source, /function pfPanelHTML\(id\)[\s\S]*?openStickerBatchImport\(\)[\s\S]*?批量添加/);
assert.match(source, /function pfGroupPanelHTML\(gid\)[\s\S]*?openStickerBatchImport\(\)[\s\S]*?批量添加/);

const functionLine = (name) => {
  const match = source.match(new RegExp(`^function ${name}\\([^\\n]+$`, "m"));
  assert.ok(match, `missing ${name}`);
  return match[0];
};
const context = vm.createContext({ URL });
vm.runInContext([
  functionLine("normalizeStickerUrl"),
  functionLine("stickerUrlName"),
  functionLine("parseStickerImportLine"),
  functionLine("parseStickerImportText"),
].join("\n"), context);

assert.equal(context.parseStickerImportLine("开心：https://img.test/happy.jpg").meaning, "开心");
assert.equal(context.parseStickerImportLine("https://img.test/sad.gif 伤心").meaning, "伤心");
assert.equal(context.parseStickerImportLine("https://img.test/%E6%B1%82%E6%8A%B1%E6%8A%B1.png").meaning, "求抱抱");
assert.equal(context.parseStickerImportText("开心：https://img.test/a.jpg\n重复：https://img.test/a.jpg").length, 1);

console.log("sticker batch import tests passed");
