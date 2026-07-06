// 小手机内置 AI · Supabase Edge Function
// 环境变量：
// PHONE_SUPABASE_URL, PHONE_SERVICE_ROLE_KEY
// OPENAI_API_KEY
// 可选：OPENAI_BASE_URL=https://api.openai.com/v1
// 可选：CHAT_MODEL=gpt-4o-mini, VISION_MODEL=gpt-4o-mini, IMAGE_MODEL=gpt-image-2
// 可选：FREE_POINTS=0（测试期建议 0，发布后再按邀请码或支付结果赠送）

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-phone-user, x-phone-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PRICE: Record<string, number> = {
  chat: 10,
  vision: 25,
  image: 120,
  tts: 10,
  summary: 2,
};

const PLANS = [
  { id: "p_990", name: "体验包", amount_cny: 9.9, points: 1000 },
  { id: "p_1990", name: "标准包", amount_cny: 19.9, points: 2300 },
  { id: "p_3990", name: "大容量包", amount_cny: 39.9, points: 5000 },
];

const supabase = createClient(
  Deno.env.get("PHONE_SUPABASE_URL") || "",
  Deno.env.get("PHONE_SERVICE_ROLE_KEY") || "",
);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
  });
}

function errText(e: unknown) {
  return String((e as Error)?.message || e || "error");
}

function publicAccount(acct: any) {
  if (!acct) return acct;
  const { client_secret: _clientSecret, ...rest } = acct;
  return rest;
}

function getUser(req: Request, body: any) {
  const raw = body?.user_id || req.headers.get("x-phone-user") || "";
  return String(raw).trim().slice(0, 80);
}

function getSecret(req: Request, body: any) {
  const raw = body?.client_secret || req.headers.get("x-phone-secret") || "";
  return String(raw).trim().slice(0, 120);
}

async function ensureAccount(userId: string, clientSecret: string) {
  const free = Math.max(0, Number(Deno.env.get("FREE_POINTS") || 0) || 0);
  const { data: old, error: selErr } = await supabase
    .from("phone_ai_accounts")
    .select("user_id,points,disabled,free_granted,client_secret")
    .eq("user_id", userId)
    .maybeSingle();
  if (selErr) throw selErr;
  if (old) {
    if (old.client_secret && old.client_secret !== clientSecret) throw new Error("bad-client-secret");
    if (!old.client_secret && clientSecret) {
      const { error } = await supabase
        .from("phone_ai_accounts")
        .update({ client_secret: clientSecret })
        .eq("user_id", userId);
      if (error) throw error;
      old.client_secret = clientSecret;
    }
    return old;
  }

  const { data, error } = await supabase
    .from("phone_ai_accounts")
    .insert({ user_id: userId, client_secret: clientSecret, points: free, free_granted: free > 0 })
    .select("user_id,points,disabled,free_granted,client_secret")
    .single();
  if (error) throw error;
  if (free > 0) {
    await supabase.from("phone_ai_ledger").insert({
      user_id: userId,
      kind: "grant",
      feature: "free",
      points: free,
      balance_after: free,
      meta: { reason: "first_open" },
    });
  }
  return data;
}

async function charge(userId: string, clientSecret: string, feature: string) {
  const cost = PRICE[feature] || 1;
  let lastBalance = 0;
  for (let i = 0; i < 4; i++) {
    const acct = await ensureAccount(userId, clientSecret);
    if (acct.disabled) throw new Error("account-disabled");
    lastBalance = acct.points || 0;
    if (lastBalance < cost) throw new Error("no-balance");

    const next = lastBalance - cost;
    const { data: updated, error } = await supabase
      .from("phone_ai_accounts")
      .update({ points: next })
      .eq("user_id", userId)
      .eq("points", lastBalance)
      .select("points")
      .maybeSingle();
    if (error) throw error;
    if (!updated) {
      await new Promise((r) => setTimeout(r, 80 + i * 90));
      continue;
    }

    const { data: row, error: le } = await supabase.from("phone_ai_ledger").insert({
      user_id: userId,
      kind: "charge",
      feature,
      points: -cost,
      balance_after: next,
      status: "pending",
    }).select("id").single();
    if (le) throw le;
    return { cost, balance: next, ledgerId: row.id as string };
  }
  throw new Error("balance-busy-retry-later");
}

async function finishCharge(ledgerId: string, ok: boolean, meta: Record<string, unknown> = {}) {
  await supabase.from("phone_ai_ledger").update({ status: ok ? "done" : "failed", meta }).eq("id", ledgerId);
}

async function refund(userId: string, clientSecret: string, feature: string, points: number, ledgerId: string, reason: string) {
  const acct = await ensureAccount(userId, clientSecret);
  const next = (acct.points || 0) + points;
  await supabase.from("phone_ai_accounts").update({ points: next }).eq("user_id", userId);
  await supabase.from("phone_ai_ledger").insert({
    user_id: userId,
    kind: "refund",
    feature,
    points,
    balance_after: next,
    request_id: ledgerId,
    meta: { reason },
  });
  await finishCharge(ledgerId, false, { refunded: true, reason });
}

async function openai(path: string, body: unknown) {
  const base = (Deno.env.get("OPENAI_BASE_URL") || "https://api.openai.com/v1").replace(/\/+$/, "");
  const key = Deno.env.get("OPENAI_API_KEY") || "";
  if (!key) throw new Error("missing-openai-key");
  const r = await fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`model-http-${r.status}: ${JSON.stringify(data || {}).slice(0, 180)}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = (await req.json().catch(() => ({}))) || {};
    const action = String(body.action || "").trim();
    const userId = getUser(req, body);
    if (!userId) return json({ ok: false, error: "missing-user" }, 400);
    const clientSecret = getSecret(req, body);
    if (!clientSecret) return json({ ok: false, error: "missing-secret" }, 400);

    if (action === "account") {
      const acct = await ensureAccount(userId, clientSecret);
      const { data: ledger } = await supabase
        .from("phone_ai_ledger")
        .select("kind,feature,points,balance_after,status,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      return json({ ok: true, account: publicAccount(acct), pricing: PRICE, plans: PLANS, ledger: ledger || [] });
    }

    if (action === "chat") {
      const c = await charge(userId, clientSecret, "chat");
      try {
        const model = body.model || Deno.env.get("CHAT_MODEL") || "gpt-4o-mini";
        const data = await openai("/chat/completions", {
          model,
          temperature: body.temperature ?? 0.8,
          max_tokens: body.max_tokens || 900,
          messages: body.messages || [],
        });
        await finishCharge(c.ledgerId, true, { model });
        return json({ ok: true, data, charged: c.cost, balance: c.balance });
      } catch (e) {
        await refund(userId, clientSecret, "chat", c.cost, c.ledgerId, errText(e));
        throw e;
      }
    }

    if (action === "vision") {
      const c = await charge(userId, clientSecret, "vision");
      try {
        const model = body.model || Deno.env.get("VISION_MODEL") || "gpt-4o-mini";
        const data = await openai("/chat/completions", {
          model,
          max_tokens: 420,
          messages: [{
            role: "user",
            content: [
              { type: "text", text: body.prompt || "请用中文描述这张图片。" },
              { type: "image_url", image_url: { url: body.image } },
            ],
          }],
        });
        await finishCharge(c.ledgerId, true, { model });
        return json({ ok: true, data, charged: c.cost, balance: c.balance });
      } catch (e) {
        await refund(userId, clientSecret, "vision", c.cost, c.ledgerId, errText(e));
        throw e;
      }
    }

    if (action === "image") {
      const c = await charge(userId, clientSecret, "image");
      try {
        const model = body.model || Deno.env.get("IMAGE_MODEL") || "gpt-image-2";
        const data = await openai("/images/generations", {
          model,
          prompt: String(body.prompt || "一张生活照片").slice(0, 1200),
          n: 1,
          size: body.size || "1024x1536",
          quality: body.quality || "medium",
          output_format: "jpeg",
        });
        await finishCharge(c.ledgerId, true, { model });
        return json({ ok: true, data, charged: c.cost, balance: c.balance });
      } catch (e) {
        await refund(userId, clientSecret, "image", c.cost, c.ledgerId, errText(e));
        throw e;
      }
    }

    return json({ ok: false, error: "unknown-action" }, 404);
  } catch (e) {
    const msg = errText(e);
    const status = msg.includes("no-balance") ? 402 : (msg.includes("disabled") || msg.includes("bad-client-secret")) ? 403 : 500;
    return json({ ok: false, error: msg }, status);
  }
});
