import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');
const native=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift',import.meta.url),'utf8');

function functionSource(name){
  const start=app.indexOf('function '+name+'(');
  assert.ok(start>=0,'missing '+name);
  const end=app.indexOf('\nfunction ',start+9);
  assert.ok(end>start,'unterminated '+name);
  return app.slice(start,end).trim();
}

test('NetEase parser only accepts canonical official song, album, playlist links or numeric IDs',()=>{
  const context=vm.createContext({URL});
  vm.runInContext('this.musicNeteaseParse='+functionSource('musicNeteaseParse'),context);
  const song=context.musicNeteaseParse('分享歌曲 https://music.163.com/#/song?id=347230');
  assert.equal(song.id,'347230');
  assert.equal(song.type,2);
  assert.equal(song.embedUrl,'https://music.163.com/outchain/player?type=2&id=347230&auto=0&height=66');
  const playlist=context.musicNeteaseParse('https://music.163.com/playlist?id=123456');
  assert.equal(playlist.type,0);
  assert.equal(playlist.frameHeight,450);
  assert.equal(context.musicNeteaseParse('35847388').type,2);
  assert.equal(context.musicNeteaseParse('https://evil.example/song?id=347230'),null);
  assert.equal(context.musicNeteaseParse('https://fake.music.163.com/song?id=347230'),null);
  assert.equal(context.musicNeteaseParse('https://music.163.com/user/home?id=347230'),null);
});

test('NetEase integration uses the official external player without scraping or member bypass',()=>{
  const parse=functionSource('musicNeteaseParse');
  const player=functionSource('musicNeteasePlayer');
  assert.match(app,/网易云官方播放器/);
  assert.match(app,/musicNeteasePanel\(\)/);
  assert.match(player,/music\.163\.com\/outchain\/player|parsed\.embedUrl/);
  assert.match(player,/allow="autoplay; encrypted-media"/);
  assert.doesNotMatch(parse+player,/\/song\/url|weapi|eapi|cookie|password|Authorization|解灰|unlock/i);
  assert.match(app,/musicSearchApple\(q\)/);
  assert.match(app,/musicSearchAudius\(q\)/);
  assert.match(app,/本地音乐/);
  assert.match(html,/\.music-netease-player iframe/);
});

test('private WKWebView only keeps the official NetEase outchain subframe in-app',()=>{
  assert.match(native,/navigationAction\.targetFrame\?\.isMainFrame == false/);
  assert.match(native,/url\.host\?\.lowercased\(\) == "music\.163\.com"/);
  assert.match(native,/url\.path == "\/outchain\/player"/);
  assert.match(native,/UIApplication\.shared\.open\(url\)/);
});
