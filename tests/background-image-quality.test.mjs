import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert.match(source, /async function compressBackground\(file\)\{let out=await compress\(file,2048,\.88\);if\(out&&out\.length>1800000\)out=await compress\(file,1800,\.82\);try\{await primeImageForSave\(out\)/);
assert.match(source, /async function primeImageForSave\(v\)[\s\S]*?await imgPut\(key,v\);_imgReady\.add\(key\)/);
assert.match(source, /function setMusicBg\(\)[\s\S]*?S\.music\.bg=await compressBackground\(f\)/);
assert.match(source, /function setHomeBg\(\)[\s\S]*?homeBg=await compressBackground\(f\)/);
assert.match(source, /function setLockBg\(\)[\s\S]*?lockBg=await compressBackground\(f\)/);
assert.match(source, /function setCallBg\(\)[\s\S]*?callBg=await compressBackground\(f\)/);
assert.match(source, /function setChatBg\(id\)[\s\S]*?chatBg=await compressBackground\(f\)/);
assert.match(source, /function changeCover\(\)[\s\S]*?momentCover=await compressBackground\(f\)/);
assert.doesNotMatch(source, /S\.music\.bg=await compress\(f,1000,\.7\)/);
assert.doesNotMatch(source, /chatBg=await compress\(f,800,\.6\)/);

console.log("background image quality tests passed");
