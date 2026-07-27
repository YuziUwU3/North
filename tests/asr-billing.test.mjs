import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const account=fs.readFileSync(new URL('../ai-account.js',import.meta.url),'utf8');
const edge=fs.readFileSync(new URL('../supabase/functions/phone-ai/index.ts',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../supabase/migrations/202607270001_asr_billing.sql',import.meta.url),'utf8');

test('built-in ASR is an independent AI-account switch',()=>{
  assert.match(app,/stt:\{base:'',key:'',model:'',relay:false\}/);
  assert.match(app,/function sttRelayOn\(\)/);
  assert.match(account,/内置语音识别/);
  assert.match(account,/function aiToggleAsrApi\(\)/);
  assert.match(app,/relay:!!oldStt\.relay/);
});
test('voice messages preserve audio and expose the recognized words',()=>{
  assert.match(app,/audio:m\.audio,content:m\.content\|\|'',showText:!!m\.content/);
  assert.match(app,/if\(sttRelayOn\(\)\)\{try\{content=await sttTranscribe\(blob,\{durationSeconds:dur\}\)/);
});

test('cinema chunks send trusted actual duration and never upload video to built-in ASR',()=>{
  assert.match(app,/durationSeconds:end-start/);
  assert.match(app,/if\(sttRelayOn\(\)\)return toast\('内置识别不会上传原视频/);
  assert.match(app,/每 '\+sttRelaySecondsPerPoint\(\)\+' 秒 1 点计费/);
});

test('server prices ASR by each started interval and attempts each configured route once',()=>{
  assert.match(edge,/asr_seconds_per_point:/);
  assert.match(edge,/Math\.ceil\(durationSeconds \/ ASR_SECONDS_PER_POINT\)/);
  assert.ok(edge.indexOf('routes.push("aliyun")')<edge.indexOf('routes.push("tencent")'));
  assert.match(edge,/for \(const route of routes\)/);
  assert.doesNotMatch(edge,/asrAttempts|retryAsr|for \(let attempt.*asr/i);
});

test('ASR billing reserve and refund are atomic and idempotent',()=>{
  assert.match(migration,/from public\.phone_ai_accounts[\s\S]*for update;/);
  assert.match(migration,/feature = 'asr'[\s\S]*request_id = p_request_id/);
  assert.match(migration,/if found then[\s\S]*'duplicate', true/);
  assert.match(migration,/if v_ledger\.status <> 'pending' then/);
  assert.match(migration,/set status = 'failed'/);
  assert.match(edge,/await refundAsrPoints\(reserved\.ledger_id, userId, reason\)/);
  assert.match(edge,/语音识别失败，本次点数已全额退回/);
});
