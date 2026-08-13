import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(
  process.argv[2] ?? 'native/private-small-phone/XcodeProject'
);
const projectPath = path.join(
  root,
  'PhoneCompanionTest.xcodeproj',
  'project.pbxproj'
);
const project = fs.readFileSync(projectPath, 'utf8');

const definitionPattern = /^\s*([A-F0-9]{24})\b[^=\n]*=\s*\{/gm;
const definitions = [...project.matchAll(definitionPattern)].map(
  (match) => match[1]
);
const duplicateDefinitions = definitions.filter(
  (identifier, index) => definitions.indexOf(identifier) !== index
);
assert.deepEqual(
  duplicateDefinitions.sort(),
  [
    'E73280A43022994F006DC874',
    'E73280BC3022B538006DC874',
    'E73280D330239BEE006DC874',
    'E73280EC3024F9F5006DC874',
    'E74615C33022636200B3739D',
    'F10000000000000000000010',
  ].sort(),
  'only the six TargetAttributes entries may repeat target identifiers'
);

const allIdentifiers = new Set(
  [...project.matchAll(/\b[A-F0-9]{24}\b/g)].map((match) => match[0])
);
const definitionSet = new Set(definitions);
const unresolved = [...allIdentifiers].filter(
  (identifier) => !definitionSet.has(identifier)
);
assert.deepEqual(
  unresolved,
  [],
  `project contains unresolved PBX identifiers: ${unresolved.join(', ')}`
);

for (const target of [
  'PhoneCompanionTest',
  'PhoneCompanionReport',
  'PhoneCompanionMonitor',
  'PhoneCompanionShield',
  'RoleNotificationService',
  'PhoneScreenBroadcast',
]) {
  assert.match(project, new RegExp(`name = ${target};`));
}

assert.match(
  project,
  /RoleNotificationService[\s\S]*?E73280EA3024F9F5006DC874 \/\* Frameworks \*\//
);
assert.match(project, /Intents\.framework in Frameworks/);
assert.match(project, /UserNotifications\.framework in Frameworks/);
assert.equal(
  (project.match(/RoleNotificationService\.appex in Embed Foundation Extensions/g) ?? []).length,
  2,
  'notification extension must have one build-file definition and one embed reference'
);

const sourceFiles = [];
for (const directory of fs.readdirSync(root, { withFileTypes: true })) {
  if (!directory.isDirectory() || directory.name.endsWith('.xcodeproj')) {
    continue;
  }
  const directoryPath = path.join(root, directory.name);
  for (const file of fs.readdirSync(directoryPath, { withFileTypes: true })) {
    if (file.isFile() && file.name.endsWith('.swift')) {
      sourceFiles.push(`${directory.name}/${file.name}`);
    }
  }
}
assert.equal(
  new Set(sourceFiles).size,
  sourceFiles.length,
  'a Swift source path is duplicated'
);

const sync = fs.readFileSync(
  path.join(root, 'PhoneCompanionTest', 'CompanionSyncView.swift'),
  'utf8'
);
const bridge = fs.readFileSync(
  path.join(root, 'PhoneCompanionTest', 'PhoneNativeBridge.swift'),
  'utf8'
);
const content = fs.readFileSync(
  path.join(root, 'PhoneCompanionTest', 'ContentView.swift'),
  'utf8'
);
const location = fs.readFileSync(
  path.join(root, 'PhoneCompanionTest', 'LocationManager.swift'),
  'utf8'
);

assert.match(sync, /\n\s*func registerPushTokenIfAvailable\(/);
assert.doesNotMatch(sync, /fileprivate func registerPushTokenIfAvailable\(/);
assert.match(bridge, /registerPushTokenIfAvailable\(/);
assert.match(content, /case \.approvedWithDataAccess:/);
assert.match(location, /MKReverseGeocodingRequest\(location: location\)/);
assert.doesNotMatch(location, /CLGeocoder|reverseGeocodeLocation/);

console.log(
  `private Xcode project validation passed: ${definitions.length} PBX objects, ` +
  `${sourceFiles.length} Swift source files`
);
