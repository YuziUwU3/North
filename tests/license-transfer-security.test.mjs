import assert from 'node:assert/strict';
import fs from 'node:fs';

const backend = fs.readFileSync(new URL('../supabase/functions/phone-license/index.ts', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/migrations/202607210004_license_transfer_security.sql', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

assert.match(backend, /TRANSFER_CREATE_COOLDOWN_MS = 30 \* 1000/);
assert.match(backend, /TRANSFER_CREATE_HOURLY_LIMIT = 10/);
assert.match(backend, /TRANSFER_REDEEM_FAILURE_LIMIT = 8/);
assert.match(backend, /TRANSFER_ATTEMPT_RETENTION_MS = 24 \* 60 \* 60 \* 1000/);
assert.match(backend, /迁移码尝试过多，请10分钟后再试/);
assert.match(backend, /from\('phone_license_transfer_attempts'\)/);
assert.match(migration, /create table if not exists public\.phone_license_transfer_attempts/);
assert.match(migration, /revoke all on public\.phone_license_transfer_attempts from public, anon, authenticated/);
assert.match(app, /Safari \/ Edge 授权合并/);
assert.match(app, /30秒内不能重复生成，每小时最多10次/);

console.log('license transfer security tests passed');
