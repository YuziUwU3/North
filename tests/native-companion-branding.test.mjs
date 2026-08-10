import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const brandRoot=path.join(root,'native','phone-companion-v857','North品牌资源');
const appIconSet=path.join(brandRoot,'NorthAppIcon.appiconset');

test('North companion branding keeps a production iOS app icon asset',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(appIconSet,'Contents.json'),'utf8'));
  assert.deepEqual(manifest.images,[{
    filename:'North-AppIcon-1024.png',
    idiom:'universal',
    platform:'ios',
    size:'1024x1024'
  }]);

  const png=fs.readFileSync(path.join(appIconSet,'North-AppIcon-1024.png'));
  assert.equal(png.subarray(1,4).toString('ascii'),'PNG');
  assert.equal(png.readUInt32BE(16),1024);
  assert.equal(png.readUInt32BE(20),1024);
  assert.equal(png[25],2,'App Store icon must use RGB without an alpha channel');
});

test('North branding instructions preserve identifiers and entitlements',()=>{
  const guide=fs.readFileSync(path.join(brandRoot,'North品牌接入说明.txt'),'utf8');
  assert.match(guide,/Display Name 改成 North/);
  assert.match(guide,/不要修改 Product Bundle Identifier/);
  assert.match(guide,/不要选择 Monitor、Report、Shield 等扩展 Target/);
  assert.match(guide,/不修改[\s\S]*Family Controls、HealthKit、定位和推送 Entitlements/);
});
