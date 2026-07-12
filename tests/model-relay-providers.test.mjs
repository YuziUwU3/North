import assert from "node:assert/strict";
import { anthropicStreamToOpenAI, anthropicToOpenAI, openAIToAnthropic, providerForModel } from "../supabase/functions/model-relay/providers.js";

assert.equal(providerForModel("claude-sonnet-4-6"), "anthropic");
assert.equal(providerForModel("claude-opus-4-6"), "anthropic");
assert.equal(providerForModel("gemini-3.5-flash"), "gemini");
assert.equal(providerForModel("gpt-5.4-mini"), "openai");

const request = openAIToAnthropic({
  model: "claude-sonnet-4-6",
  messages: [
    { role: "system", content: "Keep character." },
    { role: "user", content: "Hello" },
  ],
  max_tokens: 300,
});
assert.equal(request.system, "Keep character.");
assert.equal(request.messages[0].role, "user");
assert.equal(request.messages[0].content, "Hello");
assert.equal(request.max_tokens, 300);

const visionRequest = openAIToAnthropic({
  model: "claude-opus-4-6",
  messages: [{ role: "user", content: [
    { type: "image_url", image_url: { url: "data:image/jpeg;base64,QUJD" } },
    { type: "text", text: "Describe it" },
  ] }],
  max_tokens: 420,
});
assert.equal(visionRequest.messages[0].content[0].type, "image");
assert.equal(visionRequest.messages[0].content[0].source.media_type, "image/jpeg");
assert.equal(visionRequest.messages[0].content[0].source.data, "QUJD");
assert.equal(visionRequest.messages[0].content[1].text, "Describe it");

const response = anthropicToOpenAI({
  id: "msg_123",
  content: [{ type: "text", text: "Hi" }],
  stop_reason: "end_turn",
  usage: { input_tokens: 8, output_tokens: 2 },
}, "claude-sonnet-4-6");
assert.equal(response.object, "chat.completion");
assert.equal(response.choices[0].message.content, "Hi");
assert.equal(response.choices[0].finish_reason, "stop");
assert.equal(response.usage.total_tokens, 10);

const encoder = new TextEncoder();
const anthropicSSE = [
  'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_1"}}\n\n',
  'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}\n\n',
  'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n',
  'event: message_stop\ndata: {"type":"message_stop"}\n\n',
];
const source = new ReadableStream({ start(controller) { anthropicSSE.forEach((x) => controller.enqueue(encoder.encode(x))); controller.close(); } });
const translated = await new Response(anthropicStreamToOpenAI(source, "claude-sonnet-4-6")).text();
assert.match(translated, /"content":"Hello"/);
assert.match(translated, /"finish_reason":"stop"/);
assert.match(translated, /data: \[DONE\]/);

console.log("model relay provider contract tests passed");
