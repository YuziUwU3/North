import { cp, mkdir, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const privateRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(privateRoot, '..', '..');
const manifestPath = path.join(
  privateRoot,
  'Resources',
  'private-phone-web.manifest.json'
);
const outputRoot = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(privateRoot, 'Generated', 'PhoneWeb.bundle');

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const entries = [
  ...(manifest.files ?? []),
  ...(manifest.directories ?? [])
];

if (!entries.includes(manifest.entry)) {
  throw new Error('manifest entry must be included in files');
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

for (const relative of entries) {
  if (path.isAbsolute(relative) || relative.includes('..')) {
    throw new Error(`unsafe manifest path: ${relative}`);
  }
  const source = path.join(repoRoot, relative);
  const destination = path.join(outputRoot, relative);
  const sourceStat = await stat(source);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, {
    recursive: sourceStat.isDirectory(),
    force: true
  });
}

// WKWebView uses an ASCII entry name so the main resource and its allowed
// read directory are always resolved from exactly the same bundle path.
await cp(
  path.join(repoRoot, manifest.entry),
  path.join(outputRoot, 'index.html'),
  { force: true }
);

await cp(
  path.join(privateRoot, 'Resources', 'PhoneWebBundleInfo.plist'),
  path.join(outputRoot, 'Info.plist'),
  { force: true }
);

process.stdout.write(
  `Staged ${entries.length} shared entries to ${outputRoot}\n`
);
