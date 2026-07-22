import assert from 'node:assert/strict';
import fs from 'node:fs';

const schema = fs.readFileSync(new URL('../supabase_ai_schema.sql', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/migrations/202607230001_revoke_phone_ai_grant_points.sql', import.meta.url), 'utf8');

for (const sql of [schema, migration]) {
  assert.match(sql, /revoke all on function public\.phone_ai_grant_points\(text, integer, text\) from public;/i);
  assert.match(sql, /revoke all on function public\.phone_ai_grant_points\(text, integer, text\) from anon;/i);
  assert.match(sql, /revoke all on function public\.phone_ai_grant_points\(text, integer, text\) from authenticated;/i);
}

console.log('AI manual grant permissions are locked down.');
