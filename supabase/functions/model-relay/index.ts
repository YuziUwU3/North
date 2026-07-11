import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { anthropicStreamToOpenAI, anthropicToOpenAI, openAIToAnthropic, providerForModel } from "./providers.js";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || Deno.env.get("PHONE_SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("PHONE_SERVICE_ROLE_KEY") || "",
);

const MODELS = [
  { id: "claude-opus-4-8", owned_by: "anthropic" },
  { id: "claude-sonnet-4-6", owned_by: "anthropic" },
  { id: "claude-haiku-4-5", owned_by: "anthropic" },
  { id: "gemini-3.5-flash", owned_by: "google" },
  { id: "gemini-2.5-pro", owned_by: "google" },
  { id: "gemini-2.5-flash", owned_by: "google" },
  { id: "gpt-5.4-mini", owned_by: "openai" },
  { id: "gpt-5.4-nano", owned_by: "openai" },
  { id: "gpt-image-2", owned_by: "openai" },
];

function allowedOrigin(req: Request) {
  const configured = (Deno.env.get("ALLOWED_ORIGINS") || "*").split(",").map((x) => x.trim()).filter(Boolean);
  const origin = req.headers.get("origin") || "";
  if (configured.includes("*")) return "*";
  return configured.includes(origin) ? origin : configured[0] || "null";
}

function cors(req: Request) {
  return {
    "Access-Control-Allow-Origin": allowedOrigin(req),
    "Access-Control-Allow-Headers": "authorization, content-type, x-request-id",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8" } });
}

function openAIError(req: Request, message: string, status = 400, type = "invalid_request_error") {
  return json(req, { error: { message, type, code: type } }, status);
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map((x) => x.toString(16).padStart(2, "0")).join("");
}

function bearer(req: Request) {
  return (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || "";
}

async function authenticate(req: Request) {
  const key = bearer(req);
  if (!key.startsWith("sk-relay-")) throw new Error("invalid-api-key");
  const { data, error } = await supabase.rpc("model_relay_auth", { p_key_hash: await sha256(key) });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("invalid-api-key");
  return row;
}

function requestCost(feature: string) {
  const defaults: Record<string, number> = { chat: 10, vision: 25, image: 120 };
  const name = `${feature.toUpperCase()}_POINTS`;
  return Math.max(0, Number(Deno.env.get(name) || defaults[feature] || 1) || 0);
}

async function reserve(req: Request, model: string, feature: string) {
  const key = bearer(req);
  if (!key.startsWith("sk-relay-")) throw new Error("invalid-api-key");
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  const { data, error } = await supabase.rpc("model_relay_begin", {
    p_key_hash: await sha256(key), p_feature: feature, p_cost: requestCost(feature), p_model: model, p_request_id: requestId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("reserve-failed");
  return { ...row, requestId };
}

async function finish(usageId: string, ok: boolean, status: number, meta: Record<string, unknown> = {}) {
  await supabase.rpc("model_relay_finish", { p_usage_id: usageId, p_ok: ok, p_http_status: status, p_meta: meta });
}

function hasVision(messages: unknown) {
  return Array.isArray(messages) && messages.some((m: any) => Array.isArray(m?.content) && m.content.some((p: any) => p?.type === "image_url"));
}

function resolvedModel(model: string) {
  try {
    const aliases = JSON.parse(Deno.env.get("MODEL_ALIASES_JSON") || "{}");
    return String(aliases[model] || model);
  } catch { return model; }
}

function secretFor(provider: string) {
  if (provider === "anthropic") return Deno.env.get("ANTHROPIC_API_KEY") || "";
  if (provider === "gemini") return Deno.env.get("GEMINI_API_KEY") || "";
  return Deno.env.get("OPENAI_API_KEY") || "";
}

function providerUrl(provider: string, path: string) {
  if (provider === "anthropic") return (Deno.env.get("ANTHROPIC_BASE_URL") || "https://api.anthropic.com").replace(/\/+$/, "") + "/v1/messages";
  if (provider === "gemini") return (Deno.env.get("GEMINI_OPENAI_BASE_URL") || "https://generativelanguage.googleapis.com/v1beta/openai").replace(/\/+$/, "") + path;
  return (Deno.env.get("OPENAI_BASE_URL") || "https://api.openai.com/v1").replace(/\/+$/, "") + path;
}

async function upstream(provider: string, path: string, body: any) {
  const key = secretFor(provider);
  if (!key) throw new Error(`missing-${provider}-api-key`);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (provider === "anthropic") {
    headers["x-api-key"] = key;
    headers["anthropic-version"] = Deno.env.get("ANTHROPIC_VERSION") || "2023-06-01";
  } else headers.Authorization = `Bearer ${key}`;
  return fetch(providerUrl(provider, path), { method: "POST", headers, body: JSON.stringify(body) });
}

function relayResponse(req: Request, response: Response) {
  const headers = { ...cors(req), "Content-Type": response.headers.get("content-type") || "application/json" };
  return new Response(response.body, { status: response.status, headers });
}

async function chat(req: Request, body: any) {
  const requestedModel = String(body?.model || "").trim();
  if (!requestedModel) return openAIError(req, "model is required");
  const model = resolvedModel(requestedModel), provider = providerForModel(model), feature = hasVision(body.messages) ? "vision" : "chat";
  let usage: any;
  try { usage = await reserve(req, requestedModel, feature); }
  catch (e) { throw e; }
  try {
    if (provider === "anthropic") {
      const response = await upstream(provider, "/chat/completions", openAIToAnthropic({ ...body, model }));
      if (!response.ok) {
        const detail = await response.text();
        await finish(usage.usage_id, false, response.status, { provider, model, detail: detail.slice(0, 500) });
        return openAIError(req, `Anthropic ${response.status}: ${detail.slice(0, 300)}`, response.status, "upstream_error");
      }
      await finish(usage.usage_id, true, response.status, { provider, model, stream: body.stream === true });
      if (body.stream === true) {
        return new Response(anthropicStreamToOpenAI(response.body!, requestedModel), { headers: { ...cors(req), "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" } });
      }
      return json(req, anthropicToOpenAI(await response.json(), requestedModel));
    }
    const response = await upstream(provider, "/chat/completions", { ...body, model });
    await finish(usage.usage_id, response.ok, response.status, { provider, model, stream: body.stream === true });
    return relayResponse(req, response);
  } catch (e) {
    await finish(usage.usage_id, false, 502, { provider, model, error: String((e as Error)?.message || e) });
    return openAIError(req, String((e as Error)?.message || e), 502, "upstream_error");
  }
}

async function image(req: Request, body: any) {
  const requestedModel = String(body?.model || "gpt-image-2"), model = resolvedModel(requestedModel);
  if (providerForModel(model) !== "openai") return openAIError(req, "Image generations currently support OpenAI GPT Image models only");
  const usage = await reserve(req, requestedModel, "image");
  try {
    const response = await upstream("openai", "/images/generations", { ...body, model });
    await finish(usage.usage_id, response.ok, response.status, { provider: "openai", model });
    return relayResponse(req, response);
  } catch (e) {
    await finish(usage.usage_id, false, 502, { provider: "openai", model, error: String((e as Error)?.message || e) });
    return openAIError(req, String((e as Error)?.message || e), 502, "upstream_error");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const path = new URL(req.url).pathname.replace(/\/+$/, "");
  try {
    if (path.endsWith("/health")) return json(req, { ok: true, service: "model-relay", time: new Date().toISOString() });
    if (path.endsWith("/v1/models") && req.method === "GET") {
      await authenticate(req);
      return json(req, { object: "list", data: MODELS.map((m) => ({ ...m, object: "model", created: 0 })) });
    }
    if (path.endsWith("/v1/relay/account") && req.method === "GET") {
      const account = await authenticate(req);
      const { data: usage, error } = await supabase.from("model_relay_usage")
        .select("request_id,feature,model,points,balance_after,status,http_status,created_at,finished_at")
        .eq("key_id", account.key_id).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return json(req, { object: "relay.account", credits: account.credits, rpm_limit: account.rpm_limit, usage: usage || [] });
    }
    const body = await req.json().catch(() => ({}));
    if (path.endsWith("/v1/chat/completions") && req.method === "POST") return await chat(req, body);
    if (path.endsWith("/v1/images/generations") && req.method === "POST") return await image(req, body);
    return openAIError(req, "Not found", 404, "not_found_error");
  } catch (e) {
    const message = String((e as Error)?.message || e);
    if (/invalid-api-key|bad relay key/i.test(message)) return openAIError(req, "Invalid relay API key", 401, "authentication_error");
    if (/insufficient-credits/i.test(message)) return openAIError(req, "Insufficient credits", 402, "insufficient_quota");
    if (/rate-limit/i.test(message)) return openAIError(req, "Rate limit exceeded", 429, "rate_limit_error");
    return openAIError(req, message, 500, "relay_error");
  }
});
