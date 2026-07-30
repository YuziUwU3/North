import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const app = read('app.js');
const gate = read('license-gate.js');
const licenseBackend = read('supabase/functions/phone-license/index.ts');
const aiBackend = read('supabase/functions/phone-ai/index.ts');
const migration = read('supabase/migrations/202607300001_license_incident_recovery.sql');
const adminHtml = read('admin/index.html');
const adminApp = read('admin/app.js');

assert.match(licenseBackend, /class LicenseHttpError extends Error/);
assert.match(licenseBackend, /temporaryLicenseError[\s\S]*?503[\s\S]*?license-service-unavailable/);
assert.match(licenseBackend, /if \(error\) throw temporaryLicenseError\(\)/);
assert.match(licenseBackend, /license-admin-blocked'[\s\S]*?true/);
assert.match(licenseBackend, /license-awaiting-admin-restore/);
assert.match(licenseBackend, /async function restoreLocalIdentity/);
assert.match(licenseBackend, /phone_license_incident_recovery/);
assert.match(licenseBackend, /licenses\.find\(\(item\) => item\.status === 'active'/);
assert.match(licenseBackend, /action === 'local_identity_restore'/);
assert.match(licenseBackend, /permanent: error\.permanent/);

assert.match(gate, /out\.code = String\(payload && payload\.code/);
assert.match(gate, /out\.permanent = !!\(payload && payload\.permanent\)/);
assert.match(gate, /async function restoreLocalIdentity/);
assert.match(gate, /restoreLocalIdentity,/);

assert.match(app, /e&&e\.server&&e\.permanent===true/);
assert.doesNotMatch(app, /e&&e\.server&&e\.status===400/);
assert.match(app, /授权服务暂时拥堵，已保留当前登录/);
assert.match(app, /licenseTryIncidentRecovery/);
assert.match(app, /north_license_phone_friend_sync_v1/);
assert.match(app, /授权已自动恢复，不需要重新输入邀请码/);

assert.match(migration, /create table if not exists public\.phone_license_incident_recovery/);
assert.match(migration, /create or replace function public\.phone_license_restore_all_safe/);
assert.match(migration, /select count\(\*\) into v_total from public\.phone_licenses/);
assert.match(migration, /where l\.status <> 'active' or l\.epoch <> p_epoch/);
assert.doesNotMatch(migration, /phone_license_admin_actions/);
assert.match(migration, /now\(\) \+ interval '24 hours'/);
assert.match(migration, /grant execute on function public\.phone_license_restore_all_safe[\s\S]*?to service_role/);

assert.match(aiBackend, /action === "admin_license_restore_all"/);
assert.match(aiBackend, /const identity = requireAdmin\(req, body\)/);
assert.match(aiBackend, /supabase\.rpc\("phone_license_restore_all_safe"/);
assert.match(adminHtml, /id="licenseRestoreAllBtn" data-owner-only/);
assert.match(adminHtml, /一键恢复会把全部授权（包括已移出）恢复为可进入/);
assert.match(adminApp, /openRestoreAllLicenses/);
assert.match(adminApp, /api\('admin_license_restore_all'\)/);
assert.match(adminApp, /全部授权（包括当前显示“已移出”的用户）/);

console.log('license incident recovery tests passed');
