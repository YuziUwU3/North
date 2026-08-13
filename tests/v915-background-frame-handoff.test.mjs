import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const appDelegate = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneCompanionTestApp.swift');
const coordinator = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/ScreenShareCoordinator.swift');
const broadcast = read('native/private-small-phone/XcodeProject/PhoneScreenBroadcast/SampleHandler.swift');

test('ReplayKit keeps an external-App frame separate from the current small-phone frame', () => {
  assert.match(appDelegate, /applicationDidEnterBackground/);
  assert.match(appDelegate, /setHostForeground\(false\)/);
  assert.match(broadcast, /screen-share-background-latest\.jpg/);
  assert.match(broadcast, /screenShare\.hostForeground\.v1/);
  assert.match(broadcast, /screenShare\.backgroundFrameReady\.v1/);
  assert.match(coordinator, /let useBackground = defaults\?\.bool/);
  assert.match(coordinator, /screenFrameSource": useBackground \? "externalApp" : "latest"/);
});

test('the background handoff is one-shot and ordinary latest capture remains intact', () => {
  assert.match(coordinator, /defaults\?\.set\(false, forKey: "screenShare\.backgroundFrameReady\.v1"\)/);
  assert.match(coordinator, /try\? FileManager\.default\.removeItem\(at: backgroundSource\)/);
  assert.match(coordinator, /base\.appendingPathComponent\("screen-share-latest\.jpg"\)/);
  assert.match(broadcast, /A failed[\s\S]*must never terminate the user's broadcast/);
});
