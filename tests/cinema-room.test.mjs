import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../小手机.html", import.meta.url), "utf8");

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

function lineFunctionSource(name) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `missing ${name}`);
  const end = source.indexOf("\nfunction ", start + 10);
  return source.slice(start, end < 0 ? source.length : end).trim();
}

assert.match(source, /APP_VER='v655 · 放映室'/);
assert.match(source, /cinema:\{e:'',c:'linear-gradient\([^\n]+t:'放映室',icon:'video',lk:1\}/);
assert.match(source, /cinema:\(\)=>openApp\('cinema'\)/);
assert.match(source, /cinema:\(\)=>\{cinemaInit\(\);go\('cinema'\);\}/);
assert.match(source, /cinemawatch:'cinema',cinemaread:'cinema'/);
assert.match(source, /else if\(c\.p==='cinemawatch'\)html=renderCinemaWatch\(\)/);
assert.match(source, /else if\(c\.p==='cinemaread'\)html=renderCinemaRead\(\)/);

assert.match(source, /video\/mp4,video\/webm,video\/quicktime/);
assert.match(source, /\.srt,\.vtt,text\/vtt/);
assert.match(source, /\.txt,\.md,\.epub/);
assert.match(source, /URL\.createObjectURL\(f\)/);
assert.doesNotMatch(source, /S\.cinema\.(?:videoFile|bookText)\s*=/);

const helperContext = vm.createContext({});
vm.runInContext(
  ["cinemaParseTime", "cinemaParseSubtitles", "cinemaPaginate"].map(lineFunctionSource).join("\n") +
  ";globalThis.parse=cinemaParseSubtitles;globalThis.paginate=cinemaPaginate;",
  helperContext,
);
const cues = helperContext.parse(`WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n第一句\n\n00:00:10.500 --> 00:00:12.000\n第二句`);
assert.equal(cues.length, 2);
assert.equal(cues[0].start, 1);
assert.equal(cues[1].start, 10.5);
assert.equal(cues[1].text, "第二句");
const pages = helperContext.paginate("第一段。".repeat(180) + "\n\n" + "第二段。".repeat(180), 500);
assert.ok(pages.length >= 3);
assert.ok(pages.every((page) => page.length <= 510));

const contextSandbox = vm.createContext({
  _cin: { cues: [
    { start: 5, end: 7, text: "过去" },
    { start: 18, end: 22, text: "当前" },
    { start: 30, end: 33, text: "未来剧透" },
  ] },
  cinemaFmt: (n) => String(n),
});
vm.runInContext(lineFunctionSource("cinemaSubtitleContext") + ";globalThis.ctx=cinemaSubtitleContext(20);", contextSandbox);
assert.match(contextSandbox.ctx, /过去/);
assert.match(contextSandbox.ctx, /当前/);
assert.doesNotMatch(contextSandbox.ctx, /未来剧透/);

assert.match(source, /严禁引用后面的剧情/);
assert.match(source, /不要动作描写、第三人称叙述、括号舞台说明、心情标签/);
assert.match(source, /没有可用字幕，只知道片名；不要假装知道具体剧情/);
assert.match(source, /addSummary\(c,memory,4,'【放映室】'\)/);
assert.match(source, /S\.cinema\.sessions=\(S\.cinema\.sessions\|\|\[\]\)\.filter\(x=>x&&x\.cid!==id\)/);

assert.match(html, /\.cin-barrage\.mine\{color:#ff8fbe/);
assert.match(html, /\.cin-barrage\.role\{color:#79caff/);
assert.match(html, /\.cin-stage\.cin-theater\{position:fixed;inset:0;z-index:9999/);
assert.match(html, /原创深色影院界面/);
assert.match(html, /app\.js\?v=655/);

console.log("cinema room tests passed");
