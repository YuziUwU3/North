import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
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

const manual = functionSource("replyGenerationRun");
assert.match(source, /function replyVisibleAssistantCount\(id,aid\)/);
assert.match(source, /function manualReplyRetryAllowed\(id,aid,token\)/);
assert.match(manual, /before=replyVisibleAssistantCount\(id,aid\)/);
assert.match(manual, /await aiReply\(id,_note,token,aid\)/);
assert.match(manual, /replyVisibleAssistantCount\(id,aid\)===before&&manualReplyRetryAllowed/);
assert.match(manual, /刚才没有形成任何用户能看到的微信消息/);
assert.equal((manual.match(/await aiReply\(/g) || []).length, 2, "manual reply should make at most one automatic retry");
assert.match(manual, /这次模型没有返回可见消息，请再点一下/);

console.log("manual reply reliability tests passed");
