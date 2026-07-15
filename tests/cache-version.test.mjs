import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../小手机.html', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const repair = fs.readFileSync(new URL('../repair.html', import.meta.url), 'utf8');

const version = app.match(/APP_VER='v(\d+)\b/)?.[1];
assert.ok(version, 'app.js must expose a numeric APP_VER');

assert.match(html, new RegExp(`app\\.js\\?v=${version}\\b`));
assert.match(html, new RegExp(`sw\\.js\\?v=${version}\\b`));
assert.match(app, new RegExp(`sw\\.js\\?v=${version}\\b`));
assert.match(sw, new RegExp(`north-shell-v${version}\\b`));
assert.match(index, new RegExp(`小手机\\.html\\?v=${version}\\b`));
assert.match(repair, new RegExp(`小手机\\.html\\?v=${version}\\b`));

console.log(`cache version tests passed (v${version})`);
