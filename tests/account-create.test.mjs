import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert.match(source, /function accountCreateTap\(ev\)/);
assert.match(source, /function accountSaveTap\(ev,id,isNew\)/);
assert.match(source, /ontouchend="accountCreateTap\(event\)"/);
assert.match(source, /onpointerup="accountCreateTap\(event\)"/);
assert.match(source, /ontouchend="accountSaveTap\(event,'\$\{a\.id\}',\$\{!!a\._new\}\)"/);
assert.match(source, /const nameEl=\$\('#ac_name'\),wxidEl=\$\('#ac_wxid'\),avatarEl=\$\('#ac_av'\),personaEl=\$\('#ac_per'\)/);
assert.match(source, /\u5c0f\u53f7\u7f16\u8f91\u9875\u6ca1\u6709\u52a0\u8f7d\u5b8c\u6574/);

const actionStart = source.indexOf("let _accountTapAt=");
const actionEnd = source.indexOf("function accountSwitchFromEvent", actionStart);
assert.ok(actionStart >= 0 && actionEnd > actionStart);
let createCalls = 0;
const saveCalls = [];
const sandbox = {
  editAccount() {
    createCalls += 1;
  },
  saveAccount(id, isNew) {
    saveCalls.push([id, isNew]);
  },
};
vm.runInNewContext(
  source.slice(actionStart, actionEnd) +
    ";const ev={preventDefault(){},stopPropagation(){}};" +
    "accountCreateTap(ev);accountCreateTap(ev);" +
    "accountSaveTap(ev,'acc_test',true);accountSaveTap(ev,'acc_test',true);",
  sandbox,
);
assert.equal(createCalls, 1);
assert.deepEqual(saveCalls, [["acc_test", true]]);

console.log("account create tests passed");
