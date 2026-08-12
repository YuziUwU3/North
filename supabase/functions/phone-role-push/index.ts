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

function randomDueMinutes(profile: Record<string, unknown>) {
  const daily = Math.max(1, Math.min(24, Number(profile.daily_limit || 1)));
  const maxMinutes = Math.max(45, Math.min(360, Math.round(720 / daily)));
  return Math.round(15 + Math.random() * (maxMinutes - 15));
}

function nextDue(profile: Record<string, unknown>, waitMinutes?: number) {
  const fixed = Math.max(0, Math.min(1440, Number(profile.idle_minutes || 0)));
  const minutes = waitMinutes == null
    ? (fixed > 0 ? fixed : randomDueMinutes(profile))
    : Math.max(1, Number(waitMinutes) || 1);
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function activityQuietForThirtyMinutes(profile: Record<string, unknown>) {
  const activity = Date.parse(String(profile.last_user_at || ""));
  return Number.isFinite(activity) && Date.now() - activity >= 30 * 60_000;
}

function profileQuietPeriodEnded(profile: Record<string, unknown>) {
  const until = Date.parse(String(profile.quiet_until_at || ""));
  return !Number.isFinite(until) || until <= Date.now();
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

function roleRepeatThreshold(length: number) {
  if (length < 2) return 1;
  if (length === 2) return 1;
  if (length < 8) return (length - 1) / length;
  if (length < 12) return 0.72;
  return 0.84;
}

function roleTextRepeated(current: string, previous: string) {
  let a = roleTextKey(current).slice(0, 240);
  let b = roleTextKey(previous).slice(0, 240);
  if (!a || !b) return false;
  if (a === b) return true;
  const min = Math.min(a.length, b.length);
  if (min >= 2 && (a.includes(b) || b.includes(a))) return true;
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
  return a.length >= 2 && prior[a.length] / a.length >= roleRepeatThreshold(a.length);
}

function roleMessageParts(value: string, maxParts = 4) {
  const limit = Math.max(1, Math.min(10, Number(maxParts) || 4));
  const out: string[] = [];
  for (const raw of String(value || "").split(/\r?\n+/)) {
    const line = raw.trim();
    if (!line || out.length >= limit) continue;
    if (/^[\[【](?:图片|位置|来电)[|｜]/.test(line)) {
      out.push(line);
      continue;
    }
    const sentences = line.match(/[^。！？!?~～…]+[。！？!?~～…]+|[^。！？!?~～…]+$/g) || [line];
    for (const sentence of sentences) {
      const part = sentence.trim();
      if (part && out.length < limit) out.push(part);
    }
  }
  return out;
}

function roleRecentAssistantMessages(profile) {
  const roleName = String(profile?.role_name || "角色").trim();
  if (!roleName) return [];
  const marker = `${roleName}：`;
  return String(profile?.recent_context || "").split(/\r?\n/).map((line) => String(line || "").trim()
    .replace(/^\d{4}\/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}:\d{2}\s+/, ""))
    .filter((line) => line.startsWith(marker))
    .map((line) => line.slice(marker.length).trim()).filter(Boolean).slice(-20);
}

function roleVisibleMessageText(value: string) {
  return roleMessageParts(value, 10).filter((part) => !/^[\[【](?:图片|位置|来电)[|｜]/.test(part)).join(" ");
}

function roleMessageRepeated(current: string, previous: string) {
  if (roleTextRepeated(current, previous)) return true;
  const oldParts = roleMessageParts(previous, 10);
  return roleMessageParts(current, 10).some((part) => oldParts.some((old) => roleTextRepeated(part, old)));
}

function roleUserFactClaims(value: string) {
  return roleMessageParts(roleVisibleMessageText(value), 10).filter((part) => {
    if (/[吗呢？?]$/.test(part) || /是不是|有没有|能不能|要不要/.test(part)) return false;
    return /(?:刚|今早|今天|昨晚|刚才)?[^。！？]{0,8}(?:看见|看到|看了|翻到|翻了|摸到|摸了|注意到|发现|记得)[^。！？]{0,16}(?:你|你的)|(?:你|你的)[^。！？]{0,18}(?:自拍|照片|睡衣|衣领|领口|扣子|登机牌|位置|心率|睡眠记录|去了|拍了|发了|穿了|留在|落在|做了)/.test(part);
  });
}

function roleFactGrounded(claim: string, context: string) {
  const norm = (text: string) => String(text || "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const a = norm(claim), b = norm(context);
  if (!a || !b) return false;
  if (a.length >= 8 && b.includes(a.slice(0, Math.min(16, a.length)))) return true;
  const grams = new Set<string>();
  for (let i = 0; i < a.length - 1; i += 1) {
    const gram = a.slice(i, i + 2);
    if (!/^(?:你的?|刚才|今天|今早|昨晚|看到|发现)$/.test(gram)) grams.add(gram);
  }
  let hits = 0;
  grams.forEach((gram) => { if (b.includes(gram)) hits += 1; });
  return grams.size >= 3 && hits / grams.size >= 0.42;
}

function roleUserFactUnsupported(value: string, context: string) {
  return roleUserFactClaims(value).some((claim) => !roleFactGrounded(claim, context));
}

function roleNotificationPreview(value: string) {
  const call = String(value || "").match(/^[\[【]来电[|｜](语音|视频)[\]】]$/);
  if (call) return `${call[1]}通话邀请`;
  const visible = roleVisibleMessageText(value).replace(/\s+/g, " ").trim();
  return Array.from(visible || "发来了一条消息").slice(0, 160).join("");
}

function roleMessageStyleInvalid(value: string, maxParts = 4) {
  const text = String(value || "").trim(), parts = roleMessageParts(text, maxParts);
  return !parts.length || /[—–―]/.test(text) || /-{2,}/.test(text) || parts.length > maxParts
    || parts.some((part) => /^[\[【]/.test(part) && !/^[\[【](?:(?:图片|位置)[|｜][^\]】]+|来电[|｜](?:语音|视频))[\]】]$/.test(part));
}

async function roleMessage(profile: Record<string, unknown>, recentBodies: string[]) {
  const providers: Array<{ name: string; key: string; base: string; model: string }> = [];
  const providerFailures: string[] = [];
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
  const minimaxKey = Deno.env.get("MINIMAX_API_KEY") || "";
  if (minimaxKey) providers.push({
    name: "minimax",
    key: minimaxKey,
    base: (Deno.env.get("ROLE_PUSH_MINIMAX_BASE_URL") || "https://api.minimaxi.com/v1").replace(/\/$/, ""),
    model: Deno.env.get("ROLE_PUSH_MINIMAX_MODEL") || "MiniMax-M2.7",
  });
  if (!providers.length) return { kind: "unavailable", body: "", reason: "no-provider" };
  const clock = localClock(String(profile.timezone || "Asia/Shanghai"));
  const recent = recentBodies.map((body, index) => `${index + 1}. ${body}`).join("\n");
  const recentContext = String(profile.recent_context || "").slice(-8000).trim();
  const memoryContext = String(profile.memory_context || "").slice(-16000).trim();
  const repeatCandidates = [...recentBodies, ...roleRecentAssistantMessages(profile)];
  const messageMin = Math.max(1, Math.min(10, Number(profile.message_min) || 1));
  const messageMax = Math.max(messageMin, Math.min(10, Number(profile.message_max) || 4));
  const prompt = [
    `角色名：${String(profile.role_name || "角色").slice(0, 40)}`,
    `与用户关系：${String(profile.relation || "").slice(0, 80)}`,
    `角色设定摘要：${String(profile.persona || "").slice(0, 1200)}`,
    `用户称呼：${String(profile.user_name || "你").slice(0, 40)}`,
    `当地时间：${clock.day} ${String(clock.hour).padStart(2, "0")}:${String(clock.minute).padStart(2, "0")}`,
    memoryContext ? `同步的长期记忆、对话总结与世界设定：\n${memoryContext}` : "没有可用的长期记忆。",
    recentContext ? `你与用户最近的真实聊天（按时间顺序）：\n${recentContext}` : "最近没有可用的聊天上下文。",
    recent ? `你最近通过这条后台主动联系通道发过：\n${recent}` : "这条后台主动联系通道暂时没有近期消息。",
  ].join("\n");
  const baseMessages = [
    { role: "system", content: "这是一次与上一轮分开的主动联系新事件。最近聊天只是已经结束的事实背景，不是等待你继续回答的当前回合；绝不能隔一段时间后补答、复述或改写上一条回复。" },
    { role: "system", content: `这是恋人或亲密关系里的私人微信聊天，要像真实恋人的日常聊天，不是文案创作，也不是系统命令。先完整阅读同步的长期记忆、对话总结、世界设定和最近真实聊天，再以角色本人身份决定此刻是否真的想联系用户，以及想说什么。只有本轮随机等待的30至60分钟安静期已经结束、当前没有正在聊天生成、通话或线下互动时，这次任务才会出现；不要把它描述成刚刚还在对话。若用户很久没出现且没有交代去向，可以按角色性格自然担心、询问、想念或焦虑；若用户已经说过去做什么，就承接那条真实交代，正常想念、报备或分享自己的日常。不要把这些选项当固定流程，也不要每次都问同一句。\n想联系时，在 ${messageMin} 到 ${messageMax} 条之间自由决定，不要为了凑数强行拆句。每一条消息单独一行；一句以句号结束且意思完整时，下一句优先另起一行。可以发普通文字；想分享自己眼前的画面时，先发自然文字，再单独一行输出 [图片|具体画面描述]；想报备自己的真实地点时，先发自然文字，再单独一行输出 [位置|地点|地址]。极少数确实更想听用户声音、且符合本人性格的时刻，可以只输出 [来电|语音] 或 [来电|视频]，不能和普通消息、图片或位置同时发送。图片、位置和来电也计入条数。\n只允许根据上下文陈述用户做过、发过、穿过、去过或身体发生过的事。没有明确依据时，绝不能声称翻过用户自拍、看见用户衣着、知道用户位置、动作、身体、睡眠或心率；可以改成询问，但不能把猜测写成事实。角色可以分享符合本人设定的普通日常，但不能捏造涉及用户的共同事件。不得复述近期已经发过的话或只换几个字重复原意。口语要自然、有生活感，不像诗、小说、广告或AI范文，不要悬空比喻，不要每次直呼用户全名；严禁使用破折号或横杠字符（—、——、–、―、--），不提AI、系统、定时、通知或后台。如果本人此刻不想联系，只输出 [保持安静]。` },
    { role: "user", content: prompt },
  ];
  try {
    let sawGeneratedCandidate = false;
    for (const provider of providers) {
      let attemptMessages = baseMessages;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const response = await fetch(`${provider.base}/chat/completions`, {
            method: "POST",
            headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: provider.model,
              temperature: 0.95,
              max_tokens: Math.min(700, 120 + messageMax * 70),
              messages: attemptMessages,
            }),
          });
          if (!response.ok) {
            const failureText = await response.text();
            let failureCode = "provider-error";
            try {
              const failure = JSON.parse(failureText);
              failureCode = String(failure?.error?.code || failure?.error?.type || failure?.base_resp?.status_code || failureCode);
            } catch (_) {}
            console.warn("role-message-provider-failed", provider.name, response.status, failureCode);
            providerFailures.push(`${provider.name}:http-${response.status}:${failureCode}`);
            break;
          }
          const data = await response.json();
          const text = String(data?.choices?.[0]?.message?.content || "")
            .replace(/<think>[\s\S]*?<\/think>/gi, "")
            .trim().replace(/^[“\"']|[”\"']$/g, "");
          if (!text) break;
          sawGeneratedCandidate = true;
          if (/^[\[【]\s*(?:保持安静|不说话)\s*[\]】]$/.test(text)) return { kind: "silent", body: "" };
          const body = roleMessageParts(text.slice(0, 1200), messageMax).join("\n").trim();
          const bodyKey = roleTextKey(body);
          const repeated = !!bodyKey && repeatCandidates.some((old) => roleMessageRepeated(body, old));
          const ungrounded = roleUserFactUnsupported(body, `${recentContext}\n${memoryContext}`);
          const styleInvalid = roleMessageStyleInvalid(body, messageMax);
          if (bodyKey && !repeated && !ungrounded && !styleInvalid) {
            return { kind: "message", body };
          }
          attemptMessages = [
            ...baseMessages,
            { role: "assistant", content: body },
            { role: "user", content: ungrounded
              ? "上一版编造了聊天和记忆里没有发生过的用户自拍、衣着、位置、动作、身体状态或其他具体事件。删除所有没有真实依据的用户事实，只使用已经给出的上下文；可以按人设表达想念、担心、询问，或分享你自己的普通日常。不要解释纠正过程。"
              : styleInvalid
              ? `上一版格式不像真人微信聊天，或使用了破折号、横杠、错误标签。请保持角色本人身份，在 ${messageMin} 到 ${messageMax} 条之间自由决定，每条单独一行；不要为了凑数拆句，不要使用任何破折号或横杠。也可以只输出 [保持安静]。`
              : "这次内容与近期已经发过的话过于相似。仍由你本人决定：换一个真正不同的话题、事实和句式，或者只输出 [保持安静]；不要只改几个字重复原意。" },
          ];
        } catch (error) {
          console.warn("role-message-provider-error", provider.name, String(error?.message || error).slice(0, 160));
          providerFailures.push(`${provider.name}:network-error`);
          break;
        }
      }
    }
    return sawGeneratedCandidate
      ? { kind: "silent", body: "" }
      : { kind: "unavailable", body: "", reason: providerFailures.join(",") || "empty-provider-response" };
  } catch (_) {
    return { kind: "unavailable", body: "", reason: "decision-error" };
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
  const parts = roleMessageParts(body, 10);
  if (!parts.length) return { status: "failed-empty", error: "empty-notification" };
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    const call = part.match(/^[\[【]来电[|｜](语音|视频)[\]】]$/);
    const kind = call ? "call" : "message";
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
          alert: {
            title: call ? `${roleName || "角色"}${call[1]}来电` : (roleName || "小手机"),
            body: roleNotificationPreview(part),
          },
          sound: "default",
          badge: 1,
          "content-available": 1,
          "mutable-content": 1,
          "thread-id": `role-${roleId}-${outboxId}-${index}`,
        },
        rolePush: {
          outboxId, roleId, roleName, avatarURL: roleAvatarURL,
          kind, callKind: call?.[1] || "", messageIndex: index, messageCount: parts.length,
        },
      }),
    });
    if (!response.ok) {
      return { status: `failed-${response.status}`, error: (await response.text()).slice(0, 400) };
    }
  }
  return { status: "sent", error: "" };
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
    const unavailableReasons: Record<string, number> = {};
    for (const profile of profiles) {
      const { data: freshProfile } = await client.from("phone_role_push_profiles")
        .select("*").eq("target", profile.target).eq("role_id", profile.role_id).maybeSingle();
      if (!freshProfile?.enabled || !activityQuietForThirtyMinutes(freshProfile) || !profileQuietPeriodEnded(freshProfile) || Date.parse(String(freshProfile.next_due_at || "")) > Date.now()) {
        await client.from("phone_role_push_profiles").update({ claimed_until: null, updated_at: new Date().toISOString() })
          .eq("target", profile.target).eq("role_id", profile.role_id);
        continue;
      }
      Object.assign(profile, freshProfile);
      const clock = localClock(profile.timezone);
      const count = profile.daily_day === clock.day ? Number(profile.daily_count || 0) : 0;
      const start = Number(profile.start_hour ?? 9), end = Number(profile.end_hour ?? 23);
      const inside = start === end ? true : start < end ? clock.hour >= start && clock.hour < end : clock.hour >= start || clock.hour < end;
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
      const { data: latestProfile } = await client.from("phone_role_push_profiles")
        .select("enabled,next_due_at,last_user_at,quiet_until_at,recent_context,memory_context")
        .eq("target", profile.target).eq("role_id", profile.role_id).maybeSingle();
      if (!latestProfile?.enabled || !activityQuietForThirtyMinutes(latestProfile) || !profileQuietPeriodEnded(latestProfile) || Date.parse(String(latestProfile.next_due_at || "")) > Date.now()) {
        await client.from("phone_role_push_profiles").update({ claimed_until: null, updated_at: new Date().toISOString() })
          .eq("target", profile.target).eq("role_id", profile.role_id);
        continue;
      }
      if (decision.kind !== "message") {
        if (decision.kind === "silent") silent += 1;
        else {
          unavailable += 1;
          const reason = String(decision.reason || "unknown").slice(0, 600);
          unavailableReasons[reason] = (unavailableReasons[reason] || 0) + 1;
        }
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
    return reply({ ok: true, claimed: profiles.length, sent, silent, unavailable, unavailableReasons });
  } catch (error) {
    return reply({ error: String(error?.message || error) }, 500);
  }
});
