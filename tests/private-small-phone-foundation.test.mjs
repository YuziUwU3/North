import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('private app charter fixes the product name and freezes public North', () => {
  const charter = read('docs/maintenance/私人小手机App_唯一总纲.md');
  assert.match(charter, /私人版固定叫 \*\*小手机\*\*/);
  assert.match(charter, /当前审核中的版本保持不动/);
  assert.match(charter, /绝不能同时控制同一台真实 iPhone/);
  assert.match(charter, /命令已发送.*设备已收到.*设备已执行/s);
  assert.match(charter, /采集时间、上传时间/);
});

test('private app loads bundled phone resources instead of a remote shell', () => {
  const webView = read(
    'native/private-small-phone/Web/LocalPhoneWebView.swift'
  );
  assert.match(webView, /Bundle\.main\.url/);
  assert.match(webView, /loadFileURL/);
  assert.doesNotMatch(webView, /https?:\/\//);
});

test('private app has a versioned native bridge and shared-resource staging', () => {
  const bridge = read(
    'native/private-small-phone/Bridge/PhoneNativeBridge.swift'
  );
  const manifest = JSON.parse(read(
    'native/private-small-phone/Resources/private-phone-web.manifest.json'
  ));
  const staging = read(
    'native/private-small-phone/scripts/stage-private-phone-web.mjs'
  );
  assert.match(bridge, /contractVersion = 1/);
  assert.equal(manifest.entry, '小手机.html');
  assert.ok(manifest.files.includes('app.js'));
  assert.match(staging, /repoRoot/);
  assert.doesNotMatch(staging, /writeFile/);
});

test('controller lease contract permits exactly one named controller', () => {
  const schema = JSON.parse(read(
    'native/private-small-phone/Contracts/controller-lease.schema.json'
  ));
  assert.deepEqual(
    schema.properties.controllerKind.enum,
    ['public-north', 'private-small-phone']
  );
  assert.ok(schema.required.includes('controllerInstanceId'));
  assert.ok(schema.required.includes('leaseVersion'));
  assert.equal(schema.additionalProperties, false);
});
