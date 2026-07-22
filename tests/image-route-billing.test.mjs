import assert from "node:assert/strict";
import fs from "node:fs";

const backend = fs.readFileSync(new URL("../supabase/functions/phone-ai/index.ts", import.meta.url), "utf8");
const start = backend.indexOf('if (action === "image")');
const end = backend.indexOf('if (action === "tts")', start);
assert.ok(start >= 0 && end > start, "image action block missing");
const image = backend.slice(start, end);

assert.equal((image.match(/await charge\(userId, clientSecret, "image"\)/g) || []).length, 1, "one request must reserve points once");
assert.match(image, /for \(let i = 0; i < routes\.length; i\+\+\)/);
assert.match(image, /result = await generateImageThroughRoute\(route/);
assert.match(image, /if \(!result\) throw lastError/);
assert.equal((image.match(/await finishCharge\(c\.ledgerId, true/g) || []).length, 1, "success must settle once");
assert.equal((image.match(/await refund\(userId, clientSecret, "image", c\.cost/g) || []).length, 1, "all-route failure must refund once");
assert.doesNotMatch(image.slice(image.indexOf("for (let i = 0"), image.indexOf("if (!result)")), /\bcharge\(/, "route switch must not charge again");
assert.match(image, /fallback: usedRoute === "route-2"/);
assert.match(image, /charged: c\.cost/);
assert.match(image, /charged: 0/);
assert.match(image, /refunded: c\.cost/);

console.log("image route billing tests passed");
