import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const app = readFileSync(join(root, "app.js"), "utf8");
const html = readFileSync(join(root, "\u5c0f\u624b\u673a.html"), "utf8");

test("remote control can skip consent only when couple auto-approve is explicitly enabled", () => {
  const req = app.match(/function remoteControlRequest\(cid\)[\s\S]*?(?=\nfunction remoteControlDeny\(cid\))/)?.[0] || "";
  assert.match(req, /remoteControlAutoApprove/);
  assert.match(req, /S\.couple&&S\.couple\.remoteControlAuth!==false&&S\.couple\.remoteControlAutoApprove/);
  assert.match(req, /autoApproved:true/);
  assert.match(req, /openModal/);
  assert.match(app, /function coupleRemoteControlAutoApprove\(\)/);
  assert.match(app, /if\(S\.couple\.remoteControlAutoApprove\)S\.couple\.remoteControlAuth=true/);
  assert.match(app, /if\(!S\.couple\.remoteControlAuth\)S\.couple\.remoteControlAutoApprove=false/);
});

test("auto-approve is exposed and restorable from couple permissions", () => {
  assert.match(app, /data-couple-permission="remoteControlAutoApprove"/);
  assert.match(app, /无需每次同意，允许 \$\{nm\} 直接接管/);
  assert.match(app, /\{key:'remoteControlAutoApprove',name:'远程操控免同意权限'/);
  assert.match(app, /\['wxLoginAuth','remoteControlAuth','remoteControlAutoApprove','walletAuth','jailAuth'\]/);
  assert.match(app, /if\(key==='remoteControlAutoApprove'\)cp\.remoteControlAuth=true/);
});

test("remote control omits the redundant exit notice", () => {
  assert.doesNotMatch(html, /id="remoteControlExitNotice"/);
  assert.doesNotMatch(app, /function remoteControlExitNotice\(name\)/);
  assert.doesNotMatch(app, /remoteControlExitNotice\(c\.remark\|\|c\.name\)/);
  assert.doesNotMatch(app, /remote-consent-copy/);
  assert.doesNotMatch(app, /remote-consent-warning/);
});
