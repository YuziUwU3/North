import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// The private WKWebView deliberately keeps the pre-PWA viewport contract and
// its original phone-call layout. Browser-only shell/layout changes must not
// leak into the native App when the shared web core is staged.
export async function applyPrivatePhoneWebTransforms(outputRoot, entry) {
  const bundledEntry = path.join(outputRoot, entry);
  let privateHtml = await readFile(bundledEntry, 'utf8');
  privateHtml = privateHtml
    .replace(', viewport-fit=cover', '')
    .replace('apple-mobile-web-app-status-bar-style" content="black-translucent"', 'apple-mobile-web-app-status-bar-style" content="black"')
    .replace('apple-mobile-web-app-status-bar-style" content="default"', 'apple-mobile-web-app-status-bar-style" content="black"')
    .replace(/var url='sw\.js\?v=(\d+)&r=[^']+';/, "var url='sw.js?v=$1';")
    .replace('text-align:center;transform:translateY(18px)', 'text-align:center')
    .replace(/\.phcallidentity\{[^}]*\}/, '')
    .replace(/\.phcallsub\{[^}]*\}/, '.phcallsub{font-size:16px;color:#e5e5e8;line-height:1.5;margin:18px auto 0;width:100%;max-width:320px;min-height:60px;overflow:hidden;display:flex;align-items:center;justify-content:center}')
    .replace(/\/\* v953[^\n]*\*\/[\s\S]*?(?=\/\* 苹果主屏幕 Web App)/, '');
  await writeFile(bundledEntry, privateHtml, 'utf8');

  const bundledAppPath = path.join(outputRoot, 'app.js');
  let privateApp = await readFile(bundledAppPath, 'utf8');
  privateApp = privateApp.replace(
    '<div class="phcallperson"><div class="phcallidentity">${avatar}<div class="phcallname ${masked?\'masked\':\'\'}">${esc(name)}</div><div class="phcallnum">${esc(phFmt(c.num))}</div><div class="phcallregion">${esc(region)}</div></div><div class="phcallsub">',
    '<div class="phcallperson">${avatar}<div class="phcallname ${masked?\'masked\':\'\'}">${esc(name)}</div><div class="phcallnum">${esc(phFmt(c.num))}</div><div class="phcallregion">${esc(region)}</div><div class="phcallsub">'
  );
  await writeFile(bundledAppPath, privateApp, 'utf8');
}
