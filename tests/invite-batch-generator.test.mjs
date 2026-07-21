import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync(new URL('../supabase/migrations/202607210003_invite_batch_generator.sql', import.meta.url), 'utf8');

assert.match(sql, /p_count integer default 100/);
assert.match(sql, /p_count < 1 or p_count > 500/);
assert.match(sql, /while v_created < p_count loop/);
assert.match(sql, /on conflict \(code\) do nothing/);
assert.match(sql, /revoke all on function public\.generate_invites\(integer, text\) from public, anon, authenticated/);
assert.match(sql, /grant execute on function public\.generate_invites\(integer, text\) to service_role/);

console.log('invite batch generator tests passed');
