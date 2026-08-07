import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function base64url(value: Uint8Array | string) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function pemBytes(pem: string) {
  const body = pem.replaceAll("\\n", "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  return Uint8Array.from(atob(body), (char) => char.charCodeAt(0));
}

function derToRaw(signature: Uint8Array) {
  if (signature.length === 64) return signature;
  let offset = signature[1] & 0x80 ? 2 + (signature[1] & 0x7f) : 2;
  if (signature[0] !== 0x30 || signature[offset++] !== 0x02) throw new Error("invalid-es256-signature");
  const rLength = signature[offset++];
  const r = signature.slice(offset, offset + rLength);
  offset += rLength;
  if (signature[offset++] !== 0x02) throw new Error("invalid-es256-signature");
  const sLength = signature[offset++];
  const s = signature.slice(offset, offset + sLength);
  const raw = new Uint8Array(64);
  raw.set(r.slice(Math.max(0, r.length - 32)), 32 - Math.min(32, r.length));
  raw.set(s.slice(Math.max(0, s.length - 32)), 64 - Math.min(32, s.length));
  return raw;
}

async function apnsJWT(teamId: string, keyId: string, privateKey: string) {
  const header = base64url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const claims = base64url(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) }));
  const input = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    "pkcs8", pemBytes(privateKey), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"],
  );
  const signed = new Uint8Array(await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(input),
  ));
  return `${input}.${base64url(derToRaw(signed))}`;
}

function localClock(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const value = (kind: string) => parts.find((part) => part.type === kind)?.value || "00";
  return {
    day: `${value("year")}-${value("month")}-${value("day")}`,
    hour: Number(value("hour")) || 0,
    minute: Number(value("minute")) || 0,
  };
}

function nextDue(profile: Record<string, unknown>, waitMinutes?: number) {
  const minutes = Math.max(15, Number(waitMinutes || profile.idle_minutes || 120));
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function supabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL") || Deno.env.get("PHONE_SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("PHONE_SERVICE_ROLE_KEY") || "";
  return { url, client: createClient(url, serviceKey, { auth: { persistSession: false } }) };
}

function avatarURL(base: string, outboxId: string, token: string) {
  if (!base || !outboxId || !token) return "";
  const url = new URL(`${base.replace(/\/$/, "")}/functions/v1/phone-role-push/avatar`);
  url.searchParams.set("id", outboxId);
  url.searchParams.set("token", token);
  return url.toString();
}

function avatarBytes(value: string) {
  const match = value.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match || value.length > 50000) return null;
  try {
    const bytes = Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0));
    if (!bytes.length || bytes.length > 40000) return null;
    return { bytes, type: `image/${match[1]}` };
  } catch (_) {
    return null;
  }
}

async function serveAvatar(request: Request) {
  const requestURL = new URL(request.url);
  const id = requestURL.searchParams.get("id") || "";
  const token = requestURL.searchParams.get("token") || "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(token)) {
    return new Response("not-found", { status: 404 });
  }
  const { client } = supabaseAdmin();
  const cutoff = new Date(Date.now() - 7 * 86400_000).toISOString();
  const { data: outbox } = await client.from("phone_role_push_outbox")
    .select("target,role_id").eq("id", id).eq("avatar_token", token)
    .gte("created_at", cutoff).maybeSingle();
  if (!outbox?.target || !outbox?.role_id) return new Response("not-found", { status: 404 });
  const { data: profile } = await client.from("phone_role_push_profiles")
    .select("avatar_data").eq("target", outbox.target).eq("role_id", outbox.role_id).maybeSingle();
  const avatar = avatarBytes(String(profile?.avatar_data || ""));
  if (!avatar) return new Response("not-found", { status: 404 });
  return new Response(avatar.bytes, {
    headers: {
      "Content-Type": avatar.type,
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function roleTextKey(value: unknown) {
  return String(value || "").toLowerCase().replace(/\s+/g, "").replace(/[，。！？、,.!?~～：:；;“”"'（）()【】\[\]]/g, "");
}

function roleTextRepeated(current: string, previous: string) {
  let a = roleTextKey(current).slice(0, 240);
  let b = roleTextKey(previous).slice(0, 240);
  if (!a || !b) return false;
  if (a === b) return true;
  if (Math.min(a.length, b.length) >= 12 && (a.includes(b) || b.includes(a))) return true;
  if (a.length > b.length) [a, b] = [b, a];
  let prior = new Uint16Array(a.length + 1);
  let next = new Uint16Array(a.length + 1);
  for (let i = 0; i < b.length; i += 1) {
    for (let j = 0; j < a.length; j += 1) {
      next[j + 1] = b[i] === a[j] ? prior[j] + 1 : Math.max(prior[j + 1], next[j]);
    }
    [prior, next] = [next, prior];
    next.fill(0);
  }
  return a.length >= 12 && prior[a.length] / a.length >= 0.84;
}

async function roleMessage(profile: Record<string, unknown>, recentBodies: string[]) {
  const providers: Array<{ name: string; key: string; base: string; model: string }> = [];
  const key = Deno.env.get("OPENAI_API_KEY") || "";
  if (key) providers.push({
    name: "configured",
    key,
    base: (Deno.env.get("OPENAI_BASE_URL") || "https://api.openai.com/v1").replace(/\/$/, ""),
    model: Deno.env.get("ROLE_PUSH_MODEL") || Deno.env.get("CHAT_MODEL") || "gpt-4o-mini",
  });
  const dashscopeKey = Deno.env.get("DASHSCOPE_API_KEY") || "";
  if (dashscopeKey) providers.push({
    name: "dashscope",
    key: dashscopeKey,
    base: (Deno.env.get("DASHSCOPE_BASE_URL") || "https://dashscope.aliyuncs.com/compatible-mode/v1").replace(/\/$/, ""),
    model: Deno.env.get("ROLE_PUSH_DASHSCOPE_MODEL") || "qwen-plus",
  });
  if (!providers.length) return { kind: "unavailable", body: "" };
  const clock = localClock(String(profile.timezone || "Asia/Shanghai"));
  const recent = recentBodies.map((body, index) => `${index + 1}. ${body}`).join("\n");
  const prompt = [
    `角色名：${String(profile.role_name || "角色").slice(0, 40)}`,
    `与用户关系：${String(profile.relation || "").slice(0, 80)}`,
    `角色设定摘要：${String(profile.persona || "").slice(0, 1200)}`,
    `用户称呼：${String(profile.user_name || "你").slice(0, 40)}`,
    `当地时间：${clock.day} ${String(clock.hour).padStart(2, "0")}:${String(clock.minute).padStart(2, "0")}`,
    recent ? `你最近通过这条后台主动联系通道发过：\n${recent}` : "这条后台主动联系通道暂时没有近期消息。",
  ].join("\n");
  const messages = [
    { role: "system", content: "这是一次角色自主联系机会，不是系统命令。请以角色本人身份，根据人设、关系和当前准确时间，自主决定此刻是否真的想联系用户。想联系时只输出一句自然、简短、有生活感的中文消息；不得复述近期已经发过的话，不得套用固定问候，不提AI、系统、定时、通知或后台，不虚构具体事件。如果按角色本人意愿此刻不想联系，只输出 [保持安静]。" },
    { role: "user", content: prompt },
  ];
  try {
    let text = "";
    for (const provider of providers) {
      try {
        const response = await fetch(`${provider.base}/chat/completions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: provider.model,
            temperature: 0.9,
            max_tokens: 90,
            messages,
          }),
        });
        if (!response.ok) {
          console.warn("role-message-provider-failed", provider.name, response.status);
          continue;
        }
        const data = await response.json();
        text = String(data?.choices?.[0]?.message?.content || "").trim().replace(/^[“\"']|[”\"']$/g, "");
        if (text) break;
      } catch (error) {
        console.warn("role-message-provider-error", provider.name, String(error?.message || error).slice(0, 160));
      }
    }
    if (!text) return { kind: "unavailable", body: "" };
    if (/^[\[【]\s*(?:保持安静|不说话)\s*[\]】]$/.test(text)) return { kind: "silent", body: "" };
    const body = text.slice(0, 180).trim();
    const bodyKey = roleTextKey(body);
    if (!bodyKey || recentBodies.some((old) => roleTextRepeated(body, old))) return { kind: "silent", body: "" };
    return { kind: "message", body };
  } catch (_) {
    return { kind: "unavailable", body: "" };
  }
}

async function sendAPNs(
  deviceToken: string,
  environment: string,
  roleId: string,
  roleName: string,
  body: string,
  outboxId: string,
  roleAvatarURL: string,
) {
  const keyId = Deno.env.get("APNS_KEY_ID") || "";
  const teamId = Deno.env.get("APNS_TEAM_ID") || "";
  const privateKey = Deno.env.get("APNS_PRIVATE_KEY") || "";
  const bundleId = Deno.env.get("APNS_BUNDLE_ID") || "";
  if (!deviceToken) return { status: "no-token", error: "" };
  if (!keyId || !teamId || !privateKey || !bundleId) return { status: "apns-not-configured", error: "" };
  const jwt = await apnsJWT(teamId, keyId, privateKey);
  const host = environment === "production" ? "https://api.push.apple.com" : "https://api.sandbox.push.apple.com";
  const response = await fetch(`${host}/3/device/${encodeURIComponent(deviceToken)}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "apns-expiration": String(Math.floor(Date.now() / 1000) + 3600),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      aps: {
        alert: { title: roleName || "小手机", body },
        sound: "default",
        badge: 1,
        "content-available": 1,
        "mutable-content": 1,
        "thread-id": `role-${roleId}`,
      },
      rolePush: { outboxId, roleId, roleName, avatarURL: roleAvatarURL },
    }),
  });
  if (response.ok) return { status: "sent", error: "" };
  return { status: `failed-${response.status}`, error: (await response.text()).slice(0, 400) };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method === "GET") return serveAvatar(request);
  if (request.method !== "POST") return reply({ error: "method-not-allowed" }, 405);
  try {
    const input = await request.json().catch(() => ({}));
    if (input?.action !== "dispatch_due") return reply({ error: "invalid-action" }, 400);
    const { url, client } = supabaseAdmin();
    const { data: due, error } = await client.rpc("phone_role_push_claim_due", { p_limit: 20 });
    if (error) throw error;
    const profiles = Array.isArray(due) ? due : [];
    let sent = 0, silent = 0, unavailable = 0;
    for (const profile of profiles) {
      const clock = localClock(profile.timezone);
      const count = profile.daily_day === clock.day ? Number(profile.daily_count || 0) : 0;
      const start = Number(profile.start_hour ?? 9), end = Number(profile.end_hour ?? 23);
      const inside = start <= end ? clock.hour >= start && clock.hour < end : clock.hour >= start || clock.hour < end;
      if (!inside || count >= Number(profile.daily_limit || 2)) {
        await client.from("phone_role_push_profiles").update({
          claimed_until: null,
          daily_day: clock.day,
          daily_count: count,
          next_due_at: nextDue(profile, inside ? 180 : 60),
          updated_at: new Date().toISOString(),
        }).eq("target", profile.target).eq("role_id", profile.role_id);
        continue;
      }

      const { data: recentRows } = await client.from("phone_role_push_outbox")
        .select("body").eq("target", profile.target).eq("role_id", profile.role_id)
        .order("created_at", { ascending: false }).limit(6);
      const recentBodies = (Array.isArray(recentRows) ? recentRows : [])
        .map((row) => String(row?.body || "").trim()).filter(Boolean);
      const decision = await roleMessage(profile, recentBodies);
      if (decision.kind !== "message") {
        if (decision.kind === "silent") silent += 1;
        else unavailable += 1;
        await client.from("phone_role_push_profiles").update({
          claimed_until: null,
          next_due_at: nextDue(profile),
          updated_at: new Date().toISOString(),
        }).eq("target", profile.target).eq("role_id", profile.role_id);
        continue;
      }
      const body = decision.body;
      const dedupe = `${profile.target}:${profile.role_id}:${clock.day}:${count + 1}`;
      const { data: outbox, error: outboxError } = await client.from("phone_role_push_outbox").upsert({
        target: profile.target,
        role_id: profile.role_id,
        role_name: profile.role_name || "角色",
        body,
        trigger_kind: "scheduled",
        dedupe_key: dedupe,
      }, { onConflict: "dedupe_key", ignoreDuplicates: true }).select("id,push_status,avatar_token").maybeSingle();
      if (outboxError) throw outboxError;
      let outboxRow = outbox;
      if (!outboxRow?.id) {
        const { data: existing, error: existingError } = await client.from("phone_role_push_outbox")
          .select("id,push_status,avatar_token").eq("dedupe_key", dedupe).maybeSingle();
        if (existingError) throw existingError;
        outboxRow = existing;
      }
      const outboxId = String(outboxRow?.id || "");
      let push = { status: String(outboxRow?.push_status || "duplicate"), error: "" };
      if (outboxId && outboxRow?.push_status !== "sent") {
        const { data: link } = await client.from("phone_companion_links")
          .select("apns_device_token,apns_environment").eq("target", profile.target).maybeSingle();
        push = await sendAPNs(
          String(link?.apns_device_token || ""), String(link?.apns_environment || "sandbox"),
          String(profile.role_id || ""), String(profile.role_name || "小手机"), body, outboxId,
          avatarURL(url, outboxId, String(outboxRow?.avatar_token || "")),
        );
        await client.from("phone_role_push_outbox").update({ push_status: push.status, push_error: push.error || null }).eq("id", outboxId);
        sent += push.status === "sent" ? 1 : 0;
      }
      await client.from("phone_role_push_profiles").update({
        claimed_until: null,
        daily_day: clock.day,
        daily_count: count + 1,
        last_sent_at: new Date().toISOString(),
        next_due_at: nextDue(profile),
        updated_at: new Date().toISOString(),
      }).eq("target", profile.target).eq("role_id", profile.role_id);
    }
    return reply({ ok: true, claimed: profiles.length, sent, silent, unavailable });
  } catch (error) {
    return reply({ error: String(error?.message || error) }, 500);
  }
});
