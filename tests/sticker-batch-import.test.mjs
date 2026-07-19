import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert.match(source, /function pickFiles\(accept,cb\)[\s\S]*?i\.multiple=true/);
assert.match(source, /function addStickersBatch\(\)/);
assert.match(source, /function openStickerBatchImport\(\)/);
assert.match(source, /从相册多选图片/);
assert.match(source, /图片链接（每行一个，最多100个）/);
assert.match(source, /function addStickerLinks\(\)/);
assert.match(source, /function normalizeStickerUrl\(url\)/);
assert.match(source, /u\.protocol==='http:'\|\|u\.protocol==='https:'\?u\.href:''/);
assert.match(source, /map\(normalizeStickerUrl\)\.filter\(Boolean\)/);
assert.match(source, /slice\(0,100\)/);
assert.match(source, /const seen=new Set\(S\.me\.stickers\.map\(s=>s\.img\)\)/);
assert.match(source, /function pfPanelHTML\(id\)[\s\S]*?openStickerBatchImport\(\)[\s\S]*?批量添加/);
assert.match(source, /function pfGroupPanelHTML\(gid\)[\s\S]*?openStickerBatchImport\(\)[\s\S]*?批量添加/);

console.log("sticker batch import tests passed");
