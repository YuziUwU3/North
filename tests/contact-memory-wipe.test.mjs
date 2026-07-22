import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

function functionSource(name) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `missing ${name}`);
  const brace = source.indexOf("{", start);
  let depth = 0, quote = "", escaped = false;
  for (let i = brace; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; continue; }
    if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

assert.match(source, /APP_VER='v611 · 明确语音强制发送'/);
assert.match(source, /_lifeNotesClearedAt/);
assert.match(source, /clearContactMemoryData\(c,id\);saveNow\(\)/);

const role = {
  id: "r1", name: "Role", avatar: "avatar", persona: "persona", relation: "lover",
  voice: { lang: "英" }, bubbleStyle: { bg: "pink" }, affection: 88,
  memory: ["old"], summaries: [{ text: "summary" }], grudges: [{ text: "grudge" }],
  tasks: { date: "today" }, taskHist: ["old task"], _accountMemory: { alt: ["alt memory"] },
  _memoryMeta: { main: { old: {} } }, _memoryConflicts: { main: { oldText: "a" } },
  _memoryLastPick: { main: { picked: ["old"] } }, _dialogueEmotion: { main: { cause: "fight" } },
  _jailHandoff: { text: "jail" }, _offlineHandoff: { text: "date ending" }, gamesPlayed: ["dice"], wxLoginHistory: [{ actions: ["old"] }],
  _spyKnowledge: { contacts: { old: {} } }, _loginCode: { code: "1234" }, _lastCallEnded: { ts: 1 },
  phoneSpoofHistory: [{ num: "199" }],
  phoneAliasHistory: [{ num: "188" }], mood: "angry", moodVal: 10, coldUntil: 999,
};
const clearedAudio = [], touched = [];
const phone = {
  sms: {
    "13800138000": [{ text: "role sms" }],
    "188": [{ aliasFrom: "r1", text: "alias" }],
    "166": [{ text: "keep" }],
  },
  read: { "13800138000": 1, "188": 1, "166": 1 },
  recents: [{ num: "199" }, { num: "166" }],
  voicemail: [{ id: "v1", roleId: "r1", num: "199", voiceAudioKey: "a1" }, { id: "v2", num: "166" }],
  trash: [{ num: "199" }, { num: "166" }],
  aliasThreads: { "199": { cid: "r1", targetNum: "13800138000" }, "166": { cid: "r2" } },
  simCall: null,
};
const S = {
  me: { accounts: [{ id: "main" }, { id: "alt" }] },
  messages: {
    r1: [{ id: "m1", audio: "idb-audio:m1" }], "r1#alt": [{ content: "alt chat" }], r2: [{ content: "keep" }],
  },
  offline: { r1: { memory: ["date"] }, r2: { memory: ["keep"] } },
  offlineFocus: { cid: "r1" }, music: { chat: [{ cid: "r1" }, { cid: "r2" }] },
  alter: { "r1@r2": [{}], "r2@r3": [{}] }, alterMeta: { "r1@r2": {}, "r2@r3": {} },
  roleplay: { r1: { memory: ["plot"] }, r2: { members: [{ id: "r1" }, { id: "r2" }], msgs: [{ cid: "r1" }, { cid: "r2" }], inviteMids: { r1: "x" } } },
  spy: { r1: { granted: true, loc: true, time: "09:00", times: 2, pwd: "1234", phone: "13800138000", diary: "old", calls: ["old"] } },
  couple: { cid: "r1", behavior: { enabled: true, items: [{ promise: "old" }] }, grant: { phoneapp: true } },
  jail: { active: false, cid: "r1", msgs: ["old"] }, friendRequests: [{ contactId: "r1" }, { contactId: "r2" }],
  _spySeen: { r1: 1, r2: 2 }, _spyCount: { r1: { n: 2 }, r2: { n: 1 } },
  _proactiveDone: { r1: 1, r2: 1 }, _proactiveCount: { r1: 2, r2: 2 },
  _humanMetrics: { "main|r1": {}, "main|r2": {} }, _personaOutput: { main: [{ cid: "r1" }, { cid: "r2" }] },
  wxLogin: { by: "r1", until: Date.now() + 60000, actions: [{ text: "old" }] },
};

let loginTimerCleared = false;
const context = vm.createContext({
  S, Date, window: {}, _wxLoginTimer: 42, clearInterval: (id) => { loginTimerCleared = id === 42; },
  _phAliasFollowups: { "r1:199:sms": 1, "r2:166:sms": 1 },
  phState: () => phone, phRoleNumber: () => "13800138000", phNorm: (v) => String(v || "").replace(/\D/g, ""),
  phSmsDisplayNum: (v) => v, clearVoiceAudio: (v) => clearedAudio.push(v.id || v.voiceAudioKey),
  replyTouch: (id, aid) => touched.push(`${id}:${aid}`),
});
for (const name of ["contactMemoryThreadKey", "clearContactPhoneMemory", "clearContactRoleplayMemory", "clearContactMemoryData"]) {
  vm.runInContext(functionSource(name), context);
}
context.clearContactMemoryData(role, "r1");
const plain = (value) => JSON.parse(JSON.stringify(value));

assert.deepEqual(plain(role.memory), []);
assert.deepEqual(plain(role.summaries), []);
assert.deepEqual(plain(role.grudges), []);
assert.equal(role._accountMemory, undefined);
assert.equal(role._memoryMeta, undefined);
assert.equal(role._dialogueEmotion, undefined);
assert.equal(role._jailHandoff, undefined);
assert.equal(role._offlineHandoff, undefined);
assert.equal(role.gamesPlayed, undefined);
assert.equal(role.taskHist, undefined);
assert.equal(role.wxLoginHistory, undefined);
assert.equal(role._spyKnowledge, undefined);
assert.equal(role._loginCode, undefined);
assert.equal(role._lastCallEnded, undefined);
assert.equal(role.phoneSpoofHistory, undefined);
assert.equal(role.moodVal, 70);
assert.ok(role._memoryResetAt > 0);
assert.ok(role._lifeNotesClearedAt > 0);
assert.equal(S.messages.r1, undefined);
assert.equal(S.messages["r1#alt"], undefined);
assert.ok(S.messages.r2);
assert.equal(S.offline.r1, undefined);
assert.ok(S.offline.r2);
assert.deepEqual(plain(S.music.chat), [{ cid: "r2" }]);
assert.equal(S.alter["r1@r2"], undefined);
assert.ok(S.alter["r2@r3"]);
assert.equal(S.roleplay.r1, undefined);
assert.deepEqual(plain(S.roleplay.r2.members), [{ id: "r2" }]);
assert.deepEqual(plain(S.roleplay.r2.msgs), [{ cid: "r2" }]);
assert.equal(phone.sms["13800138000"], undefined);
assert.equal(phone.sms["188"], undefined);
assert.ok(phone.sms["166"]);
assert.deepEqual(plain(phone.recents), [{ num: "166" }]);
assert.deepEqual(plain(phone.voicemail), [{ id: "v2", num: "166" }]);
assert.deepEqual(plain(phone.trash), [{ num: "166" }]);
assert.equal(S.spy.r1.diary, undefined);
assert.equal(S.spy.r1.granted, true);
assert.equal(S.spy.r1.pwd, "1234");
assert.ok(S.spy.r1.memorySince > 0);
assert.equal(S._spySeen.r1, S.spy.r1.memorySince);
assert.equal(S._spyCount.r1, undefined);
assert.deepEqual(plain(S._spyCount.r2), { n: 1 });
assert.equal(S.couple.behavior.items.length, 0);
assert.equal(S.couple.grant.phoneapp, true);
assert.equal(S.jail.active, false);
assert.deepEqual(plain(S.friendRequests), [{ contactId: "r2" }]);
assert.deepEqual(plain(S._personaOutput.main), [{ cid: "r2" }]);
assert.equal(S._humanMetrics["main|r1"], undefined);
assert.equal(S.wxLogin, null);
assert.equal(loginTimerCleared, true);
assert.deepEqual(touched.sort(), ["r1:alt", "r1:main"]);
assert.ok(clearedAudio.includes("m1"));
assert.ok(clearedAudio.includes("v1"));

assert.equal(role.persona, "persona");
assert.equal(role.avatar, "avatar");
assert.deepEqual(plain(role.voice), { lang: "英" });
assert.deepEqual(plain(role.bubbleStyle), { bg: "pink" });
assert.equal(role.affection, 88);

assert.match(source, /if\(!picked\.length\)picked=visible\.slice\(0,3\)/);
assert.match(source, /if\(\(\+c\._memoryResetAt\|\|0\)!==resetAt\)return;/);
assert.match(source, /_sp\.memorySince\?'你的旧记忆已经被清除/);

console.log("contact memory wipe tests passed");
