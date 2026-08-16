import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'glass-theme.css'),'utf8');

test('sweetie avatars keep their circular crop without dark theme edges',()=>{
  assert.match(css,/sweetie-avatar-picker\{border:0!important;background:transparent!important;box-shadow:none!important\}/);
  assert.match(css,/sweetie-avatar-picker>img[^\{]*\{border:0!important;background:transparent!important;box-shadow:none!important\}/);
  assert.match(app,/class="sweetie-avatar-picker"/);
});

test('every rendered vinyl omits the artificial center dot and cover ring',()=>{
  assert.doesNotMatch(app,/class="music-vinyl-hole"/);
  assert.doesNotMatch(app,/class="home-record-hole"/);
  assert.doesNotMatch(app,/\$\{cover\}<b><\/b>/);
  assert.match(css,/home-vinyl-card \.vinyl-cover,html\.north-glass-ui \.music-vinyl-cover\{box-shadow:none!important\}/);
  assert.match(css,/home-vinyl-card \.vinyl-record\.wdisc,html\.north-glass-ui \.music-vinyl\{animation-duration:24s!important\}/);
});

test('the three approved sakura-pink icons are real replacement assets',()=>{
  for(const key of ['douyin','offline','dread']){
    const file=path.join(root,'assets','app-icons','glass','pink',key+'.webp');
    assert.ok(fs.statSync(file).size>30000,`${key} should remain a full lossless icon asset`);
  }
});
