import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const backend = read('supabase/functions/phone-ai/index.ts');
const migration = read('supabase/migrations/202607240001_license_admin_pagination.sql');
const adminApp = read('admin/app.js');
const adminHtml = read('admin/index.html');

assert.match(migration, /create index if not exists phone_licenses_status_created_id_idx/);
assert.match(migration, /create or replace function public\.phone_license_admin_page/);
assert.match(migration, /add column if not exists operator_id text/);
assert.match(migration, /returns jsonb/);
assert.match(migration, /l\.status = v_status/);
assert.match(migration, /replace\(lower\(l\.id::text\), '-', ''\)/);
assert.match(migration, /offset v_offset[\s\S]*limit v_limit/);
assert.match(migration, /'total', v_total/);
assert.match(migration, /latest_action\.operator_id as last_admin_operator/);
assert.match(migration, /grant execute on function public\.phone_license_admin_page[\s\S]*to service_role/);

assert.match(backend, /supabase\.rpc\("phone_license_admin_page"/);
assert.match(backend, /p_offset: \(page - 1\) \* pageSize/);
assert.match(backend, /page_size: pageSize/);
assert.doesNotMatch(backend, /for \(let start = 0; ; start \+= 1000\)/);

assert.match(adminHtml, /id="licenseStatus"/);
assert.match(adminHtml, /id="licensePrevBtn"/);
assert.match(adminHtml, /id="licenseNextBtn"/);
assert.match(adminHtml, /每页只读取50人/);
assert.match(adminApp, /const licensePageSize = 50/);
assert.match(adminApp, /page_size: licensePageSize/);
assert.match(adminApp, /query: requestedQuery/);
assert.match(adminApp, /status: requestedStatus/);
assert.match(adminApp, /licenseSearchTimer = setTimeout\(\(\) => loadLicenseUsers\(true\), 350\)/);
assert.match(adminApp, /licensePage \+= 1/);
assert.match(adminApp, /licensePage -= 1/);

console.log('license admin pagination tests passed');
