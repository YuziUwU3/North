import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backend = fs.readFileSync(path.join(root, 'supabase/functions/phone-ai/index.ts'), 'utf8');
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/202607230003_private_tts_voices.sql'),
  'utf8',
);
const account = fs.readFileSync(path.join(root, 'ai-account.js'), 'utf8');
const admin = fs.readFileSync(path.join(root, 'admin/app.js'), 'utf8');

assert.match(migration, /create table if not exists public\.phone_ai_private_voices/);
assert.match(migration, /voice_id text not null unique/);
assert.match(migration, /purchase_id uuid unique references public\.phone_ai_purchases\(id\) on delete set null/);
assert.match(migration, /enable row level security/);
assert.match(migration, /revoke all on table public\.phone_ai_private_voices from anon/);

assert.match(backend, /async function authorizedTTSVoice/);
assert.match(backend, /\.eq\("user_id", userId\)[\s\S]*?\.eq\("voice_id", voiceId\)[\s\S]*?\.eq\("status", "active"\)/);
assert.match(backend, /throw new Error\("tts-private-voice-not-owned"\)/);
assert.match(backend, /if \(action === "admin_assign_private_voice"\)/);
assert.match(backend, /purchase\.status !== "paid" \|\| purchase\.review_status !== "approved"/);
assert.match(backend, /private-voice-not-found-in-minimax-account/);
assert.match(backend, /private_voices: privateVoices/);
assert.match(backend, /const authorizedVoice = await authorizedTTSVoice\(userId, body\.voice_id\);/);
assert.ok(
  backend.indexOf('const authorizedVoice = await authorizedTTSVoice(userId, body.voice_id);')
    < backend.indexOf('const c = await charge(userId, clientSecret, "tts", ttsCost);'),
  'ownership must be verified before any TTS charge',
);
const voiceListRoute = backend.slice(
  backend.indexOf('if (action === "tts_voices")'),
  backend.indexOf('if (action === "external_tts")'),
);
assert.doesNotMatch(voiceListRoute, /minimaxVoices\(\)/);

assert.doesNotMatch(account, /onclick="aiPullVoices\(\)"/);
assert.match(account, /付款办理完成后由管理员直接绑定/);
assert.match(account, /其他AI账户也无法使用/);
assert.match(account, /function aiUsePrivateVoice/);
assert.match(admin, /绑定客户专属音色/);
assert.match(admin, /admin_assign_private_voice/);

console.log('private voice binding tests passed');
