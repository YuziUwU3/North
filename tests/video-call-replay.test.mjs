import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "小手机.html"), "utf8");

// The already-paid call audio is cached with the video-call message and reused.
assert.match(source, /async function callReplayStoreAudio\(m,ab,dur\)/);
assert.match(source, /if\(!m\|\|!ab\|\|m\._ck!==\x27video\x27\)return/);
assert.match(source, /cacheMessage:video\?callMsg:null/);
assert.match(source, /if\(opt\.cacheMessage\)await callReplayStoreAudio\(opt\.cacheMessage,ab,buf\.duration\)/);
assert.doesNotMatch(source, /callReplayStoreAudio[\s\S]{0,200}ttsArr/);

// Original subtitle and translation stay paired instead of becoming duplicate replay clips.
assert.match(source, /_callTrans:u\.trans\|\|\x27\x27/);
assert.match(source, /_callTranslationOf:callMsg\.id/);
assert.match(source, /!m\._callTranslationOf/);

// Users select clips; unsupported/old silent records are never exported as silent videos.
assert.match(source, /function clReplayPicker\(id,cs\)/);
assert.match(source, /function callReplayPickRows\(id,cs\)/);
assert.match(source, /if\(!firstAudio\)\{toast\(\x27这些片段没有可用声音，不能导出静音视频\x27\);return;\}/);

// Export contains both the canvas video track and an AudioContext destination track.
assert.match(source, /canvas\.captureStream\(30\)/);
assert.match(source, /createMediaStreamDestination\(\)/);
assert.match(source, /dest\.stream\.getAudioTracks\(\)\.forEach\(t=>stream\.addTrack\(t\)\)/);
assert.match(source, /new MediaRecorder\(stream,opts\)/);
assert.match(source, /navigator\.canShare\(\{files:\[file\]\}\)/);
assert.match(source, /if\(rows\.length>100\)\{toast\(\x27一次最多选择100段\x27\);return;\}/);
assert.match(source, /rows\.length>50\?1800000:3500000/);
assert.match(source, /let firstAudio=null/);
assert.doesNotMatch(source, /prepared\.push\(\{row,buf/);

// During an active video call, each subtle tap moves one saved utterance farther back.
assert.match(source, /function callLiveRewind\(step\)/);
assert.match(source, /call\._rewindBack=\(call\._rewindBack\|\|0\)\+\(step\|\|5\)/);
assert.match(source, /call\._rewindCursor--/);
assert.match(source, /_call\.state===\x27active\x27&&video\?`<button class="callrewind" onclick="callLiveRewind\(5\)"/);
assert.match(source, /if\(_callBusy\)\{toast\(\x27等TA说完这句话再回听\x27\);return;\}/);

// Silent legacy lines can be voiced once with the original/inferred emotion, then cached.
assert.match(source, /async function clReplayRevoice\(id,cs\)/);
assert.match(source, /x\.role===\x27assistant\x27&&!x\.action&&!x\.audio/);
assert.match(source, /ttsArr\(spoken,c,\{cue:row\.cue,interjection:row\.interjection\}\)/);
assert.match(source, /ttsRefundAudio\(ab,\x27call-revoice-decode-failed\x27\)/);
assert.match(source, /_callVoiceCue:_turnVoiceCue\|\|\x27\x27/);
assert.match(source, /function ttsRelayInterjection\(s,rawCue\)/);
assert.match(source, /voice_setting:setting/);

// User-recorded voice is replayed from its original audio; typed/recognized text remains subtitle-only.
assert.match(source, /m\.role===\x27assistant\x27\?m\.callAudio:\(m\.type===\x27voice\x27\?m\.audio:\x27\x27\)/);

// The live call send button is neutral gray, while the microphone retains its explicit state color.
assert.match(html, /\.callinput button\{[^}]*background:#4a4a50/);
assert.doesNotMatch(html, /\.callinput button\{[^}]*#ff6fa5/);
assert.match(html, /\.callrewind\{[^}]*bottom:9px[^}]*color:rgba\(255,255,255,\.48\)/);

console.log("video call replay tests passed");
