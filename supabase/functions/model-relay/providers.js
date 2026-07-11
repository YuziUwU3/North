export function providerForModel(model) {
  const id = String(model || "").toLowerCase();
  if (id.startsWith("claude-")) return "anthropic";
  if (id.startsWith("gemini-")) return "gemini";
  return "openai";
}

function contentText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return String(content || "");
  return content.filter((part) => part?.type === "text").map((part) => String(part.text || "")).join("\n");
}

function imagePart(url) {
  const match = String(url || "").match(/^data:(image\/(?:jpeg|png|gif|webp));base64,(.+)$/i);
  if (match) return { type: "image", source: { type: "base64", media_type: match[1].toLowerCase(), data: match[2] } };
  return { type: "text", text: `[Image URL: ${String(url || "").slice(0, 2000)}]` };
}

function anthropicParts(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return String(content || "");
  const parts = [];
  for (const part of content) {
    if (part?.type === "text") parts.push({ type: "text", text: String(part.text || "") });
    else if (part?.type === "image_url") parts.push(imagePart(part.image_url?.url || part.image_url));
  }
  return parts.length ? parts : "";
}

export function openAIToAnthropic(body) {
  const system = [];
  const messages = [];
  for (const raw of Array.isArray(body?.messages) ? body.messages : []) {
    const role = raw?.role;
    if (role === "system" || role === "developer") {
      const text = contentText(raw.content);
      if (text) system.push(text);
      continue;
    }
    if (role === "tool") {
      messages.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: String(raw.tool_call_id || ""), content: contentText(raw.content) }],
      });
      continue;
    }
    if (role !== "user" && role !== "assistant") continue;
    let content = anthropicParts(raw.content);
    if (role === "assistant" && Array.isArray(raw.tool_calls) && raw.tool_calls.length) {
      const blocks = Array.isArray(content) ? content : (content ? [{ type: "text", text: content }] : []);
      for (const call of raw.tool_calls) {
        let input = {};
        try { input = JSON.parse(call?.function?.arguments || "{}"); } catch { input = {}; }
        blocks.push({ type: "tool_use", id: String(call.id || crypto.randomUUID()), name: String(call?.function?.name || "tool"), input });
      }
      content = blocks;
    }
    messages.push({ role, content });
  }
  const payload = {
    model: body.model,
    max_tokens: Math.max(1, Number(body.max_tokens || body.max_completion_tokens || 2048)),
    messages,
    stream: body.stream === true,
  };
  if (system.length) payload.system = system.join("\n\n");
  if (body.temperature != null) payload.temperature = body.temperature;
  if (body.top_p != null) payload.top_p = body.top_p;
  if (body.stop != null) payload.stop_sequences = Array.isArray(body.stop) ? body.stop : [body.stop];
  if (Array.isArray(body.tools)) payload.tools = body.tools.filter((x) => x?.type === "function").map((x) => ({
    name: x.function.name,
    description: x.function.description || "",
    input_schema: x.function.parameters || { type: "object", properties: {} },
  }));
  if (body.tool_choice === "required") payload.tool_choice = { type: "any" };
  else if (body.tool_choice === "none") payload.tool_choice = { type: "none" };
  else if (body.tool_choice?.function?.name) payload.tool_choice = { type: "tool", name: body.tool_choice.function.name };
  return payload;
}

function finishReason(reason) {
  return ({ end_turn: "stop", stop_sequence: "stop", max_tokens: "length", tool_use: "tool_calls", refusal: "content_filter" })[reason] || "stop";
}

export function anthropicToOpenAI(data, requestedModel) {
  const text = (data?.content || []).filter((x) => x?.type === "text").map((x) => x.text || "").join("");
  const toolCalls = (data?.content || []).filter((x) => x?.type === "tool_use").map((x) => ({
    id: x.id,
    type: "function",
    function: { name: x.name, arguments: JSON.stringify(x.input || {}) },
  }));
  const message = { role: "assistant", content: text || null };
  if (toolCalls.length) message.tool_calls = toolCalls;
  const prompt = Number(data?.usage?.input_tokens || 0), completion = Number(data?.usage?.output_tokens || 0);
  return {
    id: data?.id || `chatcmpl_${crypto.randomUUID().replaceAll("-", "")}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: requestedModel,
    choices: [{ index: 0, message, finish_reason: finishReason(data?.stop_reason) }],
    usage: { prompt_tokens: prompt, completion_tokens: completion, total_tokens: prompt + completion },
  };
}

function sse(data) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export function anthropicStreamToOpenAI(upstreamBody, requestedModel) {
  const decoder = new TextDecoder(), encoder = new TextEncoder();
  const reader = upstreamBody.getReader();
  let buffer = "", id = `chatcmpl_${crypto.randomUUID().replaceAll("-", "")}`, sentRole = false, toolIndex = 0;
  return new ReadableStream({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() || "";
        for (const frame of frames) {
          const dataLine = frame.split(/\r?\n/).find((line) => line.startsWith("data:"));
          if (!dataLine) continue;
          let event;
          try { event = JSON.parse(dataLine.slice(5).trim()); } catch { continue; }
          if (!sentRole && (event.type === "message_start" || event.type === "content_block_start")) {
            sentRole = true;
            controller.enqueue(encoder.encode(sse({ id, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: requestedModel, choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }] })));
          }
          if (event.type === "content_block_start" && event.content_block?.type === "tool_use") {
            event._relay_tool_index = toolIndex;
            controller.enqueue(encoder.encode(sse({ id, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: requestedModel, choices: [{ index: 0, delta: { tool_calls: [{ index: toolIndex, id: event.content_block.id, type: "function", function: { name: event.content_block.name, arguments: "" } }] }, finish_reason: null }] })));
            toolIndex++;
          } else if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
            controller.enqueue(encoder.encode(sse({ id, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: requestedModel, choices: [{ index: 0, delta: { content: event.delta.text || "" }, finish_reason: null }] })));
          } else if (event.type === "content_block_delta" && event.delta?.type === "input_json_delta") {
            controller.enqueue(encoder.encode(sse({ id, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: requestedModel, choices: [{ index: 0, delta: { tool_calls: [{ index: Math.max(0, toolIndex - 1), function: { arguments: event.delta.partial_json || "" } }] }, finish_reason: null }] })));
          } else if (event.type === "message_delta") {
            controller.enqueue(encoder.encode(sse({ id, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: requestedModel, choices: [{ index: 0, delta: {}, finish_reason: finishReason(event.delta?.stop_reason) }] })));
          } else if (event.type === "message_stop") {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            reader.cancel().catch(() => {});
            return;
          }
        }
        if (frames.length) return;
      }
    },
    cancel(reason) { reader.cancel(reason); },
  });
}
