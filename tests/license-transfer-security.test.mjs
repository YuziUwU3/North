import assert from 'node:assert/strict';
import fs from 'node:fs';

const backend = fs.readFileSync(new URL('../supabase/functions/phone-license/index.ts', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/migrations/202607210004_license_transfer_security.sql', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

assert.match(backend, /\['transfer_create', 'transfer_redeem', 'recovery_create', 'recovery_redeem', 'local_identity_restore'\]\.includes\(action\)/);
assert.match(backend, /设备恢复只允许使用本人的人脸或指纹验证/);
assert.match(migration, /create table if not exists public\.phone_license_transfer_attempts/);
assert.match(migration, /revoke all on public\.phone_license_transfer_attempts from public, anon, authenticated/);
assert.match(app, /Safari \/ Edge 授权合并/);
assert.match(app, /扫脸 \/ 指纹合并/);
assert.doesNotMatch(app, /生成迁移码|生成备用恢复码|gateTransferInp/);

console.log('license transfer security tests passed');
