import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert.match(source, /function accountCreateTap\(ev\)/);
assert.match(source, /function accountSaveTap\(ev,id,isNew\)/);
assert.match(source, /_accountCreateBusy=false,_accountSaveBusy=false/);
assert.match(source, /if\(_accountCreateBusy\)return false/);
assert.match(source, /if\(_accountSaveBusy\)return false/);
assert.doesNotMatch(source, /ontouchend="accountCreateTap\(event\)"/);
assert.doesNotMatch(source, /onpointerup="accountCreateTap\(event\)"/);
assert.doesNotMatch(source, /ontouchend="accountSaveTap\(event/);
assert.doesNotMatch(source, /onpointerup="accountSaveTap\(event/);
assert.match(source, /if\(saveNow\(\)===false\)/);
assert.match(source, /\u5c0f\u53f7\u5df2\u521b\u5efa/);
assert.match(source, /const nameEl=\$\('#ac_name'\),wxidEl=\$\('#ac_wxid'\),avatarEl=\$\('#ac_av'\),personaEl=\$\('#ac_per'\)/);
assert.match(source, /\u5c0f\u53f7\u7f16\u8f91\u9875\u6ca1\u6709\u52a0\u8f7d\u5b8c\u6574/);

const actionStart = source.indexOf("let _accountTapAt=");
const actionEnd = source.indexOf("function accountSwitchFromEvent", actionStart);
assert.ok(actionStart >= 0 && actionEnd > actionStart);
let createCalls = 0;
const saveCalls = [];
const timers = [];
const sandbox = {
  setTimeout(fn) {
    timers.push(fn);
  },
  toast() {},
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
assert.equal(timers.length, 2);
assert.equal(createCalls, 0);
assert.deepEqual(saveCalls, []);
timers.forEach((fn) => fn());
assert.equal(createCalls, 1);
assert.deepEqual(saveCalls, [["acc_test", true]]);

const saveStart = source.indexOf("function saveAccount(id,isNew)");
const saveEnd = source.indexOf("async function delAccount", saveStart);
assert.ok(saveStart >= 0 && saveEnd > saveStart);
const saveSource = source.slice(saveStart, saveEnd);
const fields = {
  "#ac_name": { value: "首次小号" },
  "#ac_wxid": { value: "wx_first_alt" },
  "#ac_av": { value: "🙂" },
  "#ac_per": { value: "新身份" },
  "#ac_city": { value: "上海" },
  "#ac_age": { value: "20" },
  "#ac_adult": { checked: true },
};
let firstMgrCalls = 0;
const firstMessages = [];
const firstCreate = {
  S: { me: { active: "main", accounts: [{ id: "main", name: "主号" }] } },
  initAccounts() {},
  $: (key) => fields[key] || null,
  accountIdOK: () => true,
  genWxid: () => "generated",
  actId: () => "main",
  saveNow: () => true,
  accountMgr() {
    firstMgrCalls += 1;
  },
  toast(msg) {
    firstMessages.push(msg);
  },
};
vm.runInNewContext(saveSource + ";saveAccount('acc_first',true);", firstCreate);
assert.equal(firstCreate.S.me.accounts.length, 2);
assert.equal(firstCreate.S.me.accounts[1].name, "首次小号");
assert.equal(firstCreate.S.me.accounts[1].wxid, "wx_first_alt");
assert.equal(firstMgrCalls, 1);
assert.deepEqual(firstMessages, ["小号已创建"]);

let failedMgrCalls = 0;
const failedMessages = [];
const failedCreate = {
  ...firstCreate,
  S: { me: { active: "main", accounts: [{ id: "main", name: "主号" }] } },
  saveNow: () => false,
  accountMgr() {
    failedMgrCalls += 1;
  },
  toast(msg) {
    failedMessages.push(msg);
  },
};
vm.runInNewContext(saveSource + ";saveAccount('acc_failed',true);", failedCreate);
assert.equal(failedCreate.S.me.accounts.length, 1);
assert.equal(failedMgrCalls, 1);
assert.match(failedMessages.join(" "), /没有写入存档/);

console.log("account create tests passed");
