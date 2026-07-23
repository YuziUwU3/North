import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('PHONE_SUPABASE_URL') || Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY = Deno.env.get('PHONE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const RP_ID = Deno.env.get('LICENSE_RP_ID') || 'fenglina35-dotcom.github.io';
const RP_NAME = 'North 小手机';
const MAX_SESSIONS = 3;
const TRANSFER_CREATE_COOLDOWN_MS = 30 * 1000;
const TRANSFER_CREATE_HOURLY_LIMIT = 10;
const TRANSFER_REDEEM_WINDOW_MS = 10 * 60 * 1000;
const TRANSFER_REDEEM_FAILURE_LIMIT = 8;
const TRANSFER_ATTEMPT_RETENTION_MS = 24 * 60 * 60 * 1000;
// 大刷新时与 app.js 的 SHARE_EPOCH 一起递增并重新部署，旧通行密钥将无法恢复。
const LICENSE_EPOCH = Number(Deno.env.get('LICENSE_EPOCH') || 4);
const ALLOWED_ORIGINS = new Set([
  'https://fenglina35-dotcom.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type JsonMap = Record<string, unknown>;

function requestOrigin(req: Request): string {
  const origin = req.headers.get('origin') || '';
  if (origin && ALLOWED_ORIGINS.has(origin)) return origin;
  if (!origin) return `https://${RP_ID}`;
  throw new Error('当前打开地址不支持手机授权');
}

function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : `https://${RP_ID}`,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
    'Vary': 'Origin',
  };
}

function reply(req: Request, body: JsonMap, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(req) });
}

function cleanText(value: unknown, max = 160): string {
  return String(value || '').trim().slice(0, max);
}

function cleanInvite(value: unknown): string {
  return cleanText(value, 80).replace(/\s+/g, '').toUpperCase();
}

function cleanTransferCode(value: unknown): string {
  return cleanText(value, 24).replace(/[^A-Z0-9]/gi, '').toUpperCase();
}

function randomHex(byteLength = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function randomTransferCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function transferRequesterHash(req: Request): Promise<string> {
  const forwarded = cleanText(req.headers.get('x-forwarded-for'), 180).split(',')[0].trim();
  const ip = forwarded || cleanText(req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip'), 80) || 'unknown';
  const ua = cleanText(req.headers.get('user-agent'), 300);
  return sha256Hex(`${ip}|${ua}`);
}

function bytesToBase64URL(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64URLToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
}

async function activeLicense(licenseId: string) {
  const { data, error } = await supabase
    .from('phone_licenses')
    .select('id,status,epoch')
    .eq('id', licenseId)
    .maybeSingle();
  if (error || !data || data.status !== 'active' || Number(data.epoch) !== LICENSE_EPOCH) {
    throw new Error('手机授权已失效');
  }
  return data;
}

async function sessionAuth(tokenValue: unknown) {
  const token = cleanText(tokenValue, 180);
  if (!token) throw new Error('本浏览器还没有授权');
  const tokenHash = await sha256Hex(token);
  const { data, error } = await supabase
    .from('phone_license_sessions')
    .select('id,license_id,label,created_at,last_seen_at')
    .eq('token_hash', tokenHash)
    .is('revoked_at', null)
    .maybeSingle();
  if (error || !data) throw new Error('本浏览器授权已失效');
  await activeLicense(data.license_id);
  return { ...data, token };
}

async function registrationAuth(body: JsonMap) {
  if (body.sessionToken) {
    const session = await sessionAuth(body.sessionToken);
    return { licenseId: session.license_id as string, session, bootstrap: false };
  }
  const licenseId = cleanText(body.licenseId, 80);
  const bootstrap = cleanText(body.bootstrapToken, 180);
  if (!licenseId || !bootstrap) throw new Error('缺少手机绑定凭证');
  const tokenHash = await sha256Hex(bootstrap);
  const { data, error } = await supabase
    .from('phone_license_bootstraps')
    .select('license_id,expires_at,used_at')
    .eq('license_id', licenseId)
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (error || !data || data.used_at || new Date(data.expires_at).getTime() < Date.now()) {
    throw new Error('手机绑定凭证已失效');
  }
  await activeLicense(licenseId);
  return { licenseId, session: null, bootstrap: true };
}

async function createSession(licenseId: string, req: Request, labelValue: unknown) {
  await activeLicense(licenseId);
  const token = randomHex(32);
  const tokenHash = await sha256Hex(token);
  const label = cleanText(labelValue, 80) || '手机浏览器';
  const userAgent = cleanText(req.headers.get('user-agent'), 400);
  const { data: inserted, error: insertError } = await supabase
    .from('phone_license_sessions')
    .insert({ license_id: licenseId, token_hash: tokenHash, label, user_agent: userAgent })
    .select('id')
    .single();
  if (insertError || !inserted) throw new Error('创建浏览器授权失败');

  const { data: sessions, error: listError } = await supabase
    .from('phone_license_sessions')
    .select('id,label,created_at')
    .eq('license_id', licenseId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });
  if (listError) throw new Error('检查浏览器名额失败');
  const overflow = (sessions || []).slice(MAX_SESSIONS);
  if (overflow.length) {
    const ids = overflow.map((row) => row.id);
    await supabase
      .from('phone_license_sessions')
      .update({ revoked_at: new Date().toISOString() })
      .in('id', ids)
      .is('revoked_at', null);
  }
  await supabase
    .from('phone_licenses')
    .update({ updated_at: new Date().toISOString(), last_seen_at: new Date().toISOString() })
    .eq('id', licenseId);
  return {
    token,
    licenseId,
    sessionId: inserted.id,
    activeCount: Math.min((sessions || []).length, MAX_SESSIONS),
    evicted: overflow.map((row) => cleanText(row.label, 80)),
  };
}

async function activateInvite(req: Request, body: JsonMap) {
  const inviteCode = cleanInvite(body.inviteCode);
  if (!inviteCode) throw new Error('请输入邀请码');
  const { data, error } = await supabase.rpc('redeem_invite_license', {
    p_code: inviteCode,
    p_epoch: LICENSE_EPOCH,
    p_label: cleanText(body.deviceLabel, 80) || '手机浏览器',
    p_user_agent: cleanText(req.headers.get('user-agent'), 400),
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (error) {
    console.error('redeem_invite_license', error.message);
    throw new Error('邀请码验证服务暂时不可用');
  }
  if (!row?.license_id || !row?.bootstrap_token || !row?.session_token || !row?.session_id) {
    throw new Error('邀请码无效或已经使用');
  }
  const session = {
    token: row.session_token,
    licenseId: row.license_id,
    sessionId: row.session_id,
    activeCount: 1,
    evicted: [],
  };
  return { ok: true, session, bootstrapToken: row.bootstrap_token };
}

async function activateLegacy(req: Request, body: JsonMap) {
  const legacyToken = cleanText(body.legacyDeviceToken, 180);
  if (legacyToken.length < 32 || Number(body.legacyEpoch) !== 3) throw new Error('旧版授权校验失败');
  const legacyHash = await sha256Hex(legacyToken);
  let { data: license, error } = await supabase
    .from('phone_licenses')
    .select('id,status,epoch')
    .eq('legacy_device_hash', legacyHash)
    .maybeSingle();
  if (error) throw new Error('读取旧版授权失败');
  let bootstrapToken = '';
  if (!license) {
    const inserted = await supabase
      .from('phone_licenses')
      .insert({ legacy_device_hash: legacyHash, epoch: LICENSE_EPOCH })
      .select('id,status,epoch')
      .single();
    if (inserted.error || !inserted.data) throw new Error('升级旧版授权失败');
    license = inserted.data;
    bootstrapToken = randomHex(32);
    const bootstrapHash = await sha256Hex(bootstrapToken);
    const saved = await supabase.from('phone_license_bootstraps').insert({
      license_id: license.id,
      token_hash: bootstrapHash,
    });
    if (saved.error) throw new Error('保存手机绑定凭证失败');
  }
  if (license.status !== 'active' || Number(license.epoch) !== LICENSE_EPOCH) {
    throw new Error('手机授权已失效');
  }
  const session = await createSession(license.id, req, body.deviceLabel);
  return { ok: true, session, bootstrapToken };
}

async function registrationOptions(req: Request, body: JsonMap) {
  const origin = requestOrigin(req);
  const auth = await registrationAuth(body);
  const { data: passkeys, error } = await supabase
    .from('phone_license_passkeys')
    .select('credential_id,transports')
    .eq('license_id', auth.licenseId);
  if (error) throw new Error('读取手机通行密钥失败');
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: new TextEncoder().encode(auth.licenseId),
    userName: `north-${auth.licenseId.slice(0, 8)}`,
    userDisplayName: 'North 手机授权',
    attestationType: 'none',
    excludeCredentials: (passkeys || []).map((key) => ({
      id: key.credential_id,
      transports: key.transports || [],
    })),
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'required',
    },
    supportedAlgorithmIDs: [-7, -257],
    timeout: 60000,
  });
  const { data: challenge, error: challengeError } = await supabase
    .from('phone_license_challenges')
    .insert({
      kind: 'register',
      license_id: auth.licenseId,
      challenge: options.challenge,
      origin,
    })
    .select('id')
    .single();
  if (challengeError || !challenge) throw new Error('创建手机验证失败');
  return { ok: true, options, challengeId: challenge.id };
}

async function registrationVerify(req: Request, body: JsonMap) {
  const auth = await registrationAuth(body);
  const challengeId = cleanText(body.challengeId, 80);
  const { data: challenge, error } = await supabase
    .from('phone_license_challenges')
    .select('id,license_id,challenge,origin,expires_at,used_at')
    .eq('id', challengeId)
    .eq('kind', 'register')
    .maybeSingle();
  if (
    error || !challenge || challenge.license_id !== auth.licenseId || challenge.used_at ||
    new Date(challenge.expires_at).getTime() < Date.now()
  ) throw new Error('手机验证已过期，请重新点击绑定');
  const verification = await verifyRegistrationResponse({
    response: body.credential as never,
    expectedChallenge: challenge.challenge,
    expectedOrigin: challenge.origin,
    expectedRPID: RP_ID,
    requireUserVerification: true,
  });
  if (!verification.verified || !verification.registrationInfo) throw new Error('系统没有完成手机验证');
  const info = verification.registrationInfo;
  const credential = info.credential;
  const saved = await supabase.from('phone_license_passkeys').upsert({
    license_id: auth.licenseId,
    credential_id: credential.id,
    public_key: bytesToBase64URL(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports || [],
    device_type: info.credentialDeviceType,
    backed_up: info.credentialBackedUp,
    last_used_at: new Date().toISOString(),
  }, { onConflict: 'credential_id' });
  if (saved.error) throw new Error('保存手机通行密钥失败');
  await supabase
    .from('phone_license_challenges')
    .update({ used_at: new Date().toISOString() })
    .eq('id', challenge.id)
    .is('used_at', null);
  if (auth.bootstrap) {
    await supabase
      .from('phone_license_bootstraps')
      .update({ used_at: new Date().toISOString() })
      .eq('license_id', auth.licenseId)
      .is('used_at', null);
  }
  const session = auth.session
    ? { token: auth.session.token, licenseId: auth.licenseId, sessionId: auth.session.id }
    : await createSession(auth.licenseId, req, body.deviceLabel);
  return { ok: true, session, passkeyCount: 1 };
}

async function authenticationOptions(req: Request) {
  const origin = requestOrigin(req);
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: 'required',
    timeout: 60000,
  });
  const { data: challenge, error } = await supabase
    .from('phone_license_challenges')
    .insert({ kind: 'authenticate', challenge: options.challenge, origin })
    .select('id')
    .single();
  if (error || !challenge) throw new Error('创建恢复验证失败');
  return { ok: true, options, challengeId: challenge.id };
}

async function authenticationVerify(req: Request, body: JsonMap) {
  const challengeId = cleanText(body.challengeId, 80);
  const credential = body.credential as JsonMap;
  const credentialId = cleanText(credential?.id, 1024);
  if (!credentialId) throw new Error('没有读到手机通行密钥');
  const { data: challenge, error } = await supabase
    .from('phone_license_challenges')
    .select('id,challenge,origin,expires_at,used_at')
    .eq('id', challengeId)
    .eq('kind', 'authenticate')
    .maybeSingle();
  if (error || !challenge || challenge.used_at || new Date(challenge.expires_at).getTime() < Date.now()) {
    throw new Error('恢复验证已过期，请重新点击恢复');
  }
  const { data: passkey, error: keyError } = await supabase
    .from('phone_license_passkeys')
    .select('id,license_id,credential_id,public_key,counter,transports')
    .eq('credential_id', credentialId)
    .maybeSingle();
  if (keyError || !passkey) throw new Error('这台手机没有可恢复的授权');
  await activeLicense(passkey.license_id);
  const verification = await verifyAuthenticationResponse({
    response: body.credential as never,
    expectedChallenge: challenge.challenge,
    expectedOrigin: challenge.origin,
    expectedRPID: RP_ID,
    credential: {
      id: passkey.credential_id,
      publicKey: base64URLToBytes(passkey.public_key),
      counter: Number(passkey.counter) || 0,
      transports: passkey.transports || [],
    },
    requireUserVerification: true,
  });
  if (!verification.verified) throw new Error('系统没有完成手机验证');
  await supabase
    .from('phone_license_passkeys')
    .update({
      counter: verification.authenticationInfo.newCounter,
      last_used_at: new Date().toISOString(),
    })
    .eq('id', passkey.id);
  await supabase
    .from('phone_license_challenges')
    .update({ used_at: new Date().toISOString() })
    .eq('id', challenge.id)
    .is('used_at', null);
  const session = await createSession(passkey.license_id, req, body.deviceLabel);
  return { ok: true, session };
}

async function checkSession(body: JsonMap) {
  const session = await sessionAuth(body.sessionToken);
  const now = new Date().toISOString();
  await supabase.from('phone_license_sessions').update({ last_seen_at: now }).eq('id', session.id);
  await supabase.from('phone_licenses').update({ last_seen_at: now }).eq('id', session.license_id);
  const [{ count: sessionCount }, { count: passkeyCount }] = await Promise.all([
    supabase
      .from('phone_license_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('license_id', session.license_id)
      .is('revoked_at', null),
    supabase
      .from('phone_license_passkeys')
      .select('*', { count: 'exact', head: true })
      .eq('license_id', session.license_id),
  ]);
  return {
    ok: true,
    valid: true,
    licenseId: session.license_id,
    sessionId: session.id,
    sessionCount: sessionCount || 0,
    passkeyCount: passkeyCount || 0,
  };
}

async function listSessions(body: JsonMap) {
  const session = await sessionAuth(body.sessionToken);
  const { data, error } = await supabase
    .from('phone_license_sessions')
    .select('id,label,created_at,last_seen_at')
    .eq('license_id', session.license_id)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error('读取浏览器授权失败');
  return {
    ok: true,
    currentSessionId: session.id,
    sessions: (data || []).map((row) => ({ ...row, current: row.id === session.id })),
  };
}

async function revokeSession(body: JsonMap) {
  const session = await sessionAuth(body.sessionToken);
  const targetId = cleanText(body.targetSessionId, 80);
  const { data, error } = await supabase
    .from('phone_license_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', targetId)
    .eq('license_id', session.license_id)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle();
  if (error || !data) throw new Error('这个浏览器授权已经移除');
  return { ok: true, revokedCurrent: targetId === session.id };
}

async function createTransfer(req: Request, body: JsonMap) {
  const session = await sessionAuth(body.sessionToken);
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const [{ count: recentCount, error: countError }, { data: latest, error: latestError }] = await Promise.all([
    supabase
      .from('phone_license_transfers')
      .select('*', { count: 'exact', head: true })
      .eq('license_id', session.license_id)
      .gte('created_at', hourAgo),
    supabase
      .from('phone_license_transfers')
      .select('created_at')
      .eq('license_id', session.license_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (countError || latestError) throw new Error('检查迁移码生成频率失败');
  if ((recentCount || 0) >= TRANSFER_CREATE_HOURLY_LIMIT) throw new Error('迁移码生成过于频繁，请一小时后再试');
  if (latest && Date.now() - new Date(latest.created_at).getTime() < TRANSFER_CREATE_COOLDOWN_MS) {
    throw new Error('请30秒后再生成新的迁移码');
  }
  await supabase
    .from('phone_license_transfers')
    .update({ used_at: new Date().toISOString() })
    .eq('license_id', session.license_id)
    .is('used_at', null);
  const code = randomTransferCode();
  const codeHash = await sha256Hex(code);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const { error } = await supabase.from('phone_license_transfers').insert({
    license_id: session.license_id,
    code_hash: codeHash,
    created_by_session: session.id,
    expires_at: expiresAt,
  });
  if (error) throw new Error('生成迁移码失败');
  return { ok: true, code: `${code.slice(0, 4)}-${code.slice(4)}`, expiresAt };
}

async function redeemTransfer(req: Request, body: JsonMap) {
  const requesterHash = await transferRequesterHash(req);
  await supabase
    .from('phone_license_transfer_attempts')
    .delete()
    .lt('created_at', new Date(Date.now() - TRANSFER_ATTEMPT_RETENTION_MS).toISOString());
  const attemptCutoff = new Date(Date.now() - TRANSFER_REDEEM_WINDOW_MS).toISOString();
  const { count: failedCount, error: attemptError } = await supabase
    .from('phone_license_transfer_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('requester_hash', requesterHash)
    .gte('created_at', attemptCutoff);
  if (attemptError) throw new Error('检查迁移码安全限制失败');
  if ((failedCount || 0) >= TRANSFER_REDEEM_FAILURE_LIMIT) throw new Error('迁移码尝试过多，请10分钟后再试');
  const code = cleanTransferCode(body.transferCode);
  if (code.length !== 8) {
    await supabase.from('phone_license_transfer_attempts').insert({ requester_hash: requesterHash });
    throw new Error('请输入8位迁移码');
  }
  const codeHash = await sha256Hex(code);
  const { data: transfer, error } = await supabase
    .from('phone_license_transfers')
    .select('id,license_id,expires_at,used_at')
    .eq('code_hash', codeHash)
    .maybeSingle();
  if (error || !transfer || transfer.used_at || new Date(transfer.expires_at).getTime() < Date.now()) {
    await supabase.from('phone_license_transfer_attempts').insert({ requester_hash: requesterHash });
    throw new Error('迁移码无效、已使用或已过期');
  }
  const { data: claimed, error: claimError } = await supabase
    .from('phone_license_transfers')
    .update({ used_at: new Date().toISOString() })
    .eq('id', transfer.id)
    .is('used_at', null)
    .select('id')
    .maybeSingle();
  if (claimError || !claimed) throw new Error('迁移码已经被使用');
  const session = await createSession(transfer.license_id, req, body.deviceLabel);
  await supabase.from('phone_license_transfer_attempts').delete().eq('requester_hash', requesterHash);
  return { ok: true, session };
}

async function syncAIIdentity(body: JsonMap) {
  const session = await sessionAuth(body.sessionToken);
  const proposedUserId = cleanText(body.userId, 140);
  const proposedSecret = cleanText(body.clientSecret, 260);
  const { data: current, error } = await supabase
    .from('phone_licenses')
    .select('id,ai_user_id,ai_client_secret')
    .eq('id', session.license_id)
    .single();
  if (error || !current) throw new Error('读取AI账户绑定失败');
  if (current.ai_user_id && current.ai_client_secret) {
    return {
      ok: true,
      userId: current.ai_user_id,
      clientSecret: current.ai_client_secret,
      existing: true,
    };
  }
  if (proposedUserId.length < 8 || proposedSecret.length < 16) throw new Error('本机AI账户身份不完整');
  const { data: claimed, error: claimError } = await supabase
    .from('phone_licenses')
    .update({
      ai_user_id: proposedUserId,
      ai_client_secret: proposedSecret,
      updated_at: new Date().toISOString(),
    })
    .eq('id', session.license_id)
    .is('ai_user_id', null)
    .select('ai_user_id,ai_client_secret')
    .maybeSingle();
  if (claimError) throw new Error('绑定AI账户失败');
  if (claimed) {
    return {
      ok: true,
      userId: claimed.ai_user_id,
      clientSecret: claimed.ai_client_secret,
      existing: false,
    };
  }
  const { data: winner, error: winnerError } = await supabase
    .from('phone_licenses')
    .select('ai_user_id,ai_client_secret')
    .eq('id', session.license_id)
    .single();
  if (winnerError || !winner?.ai_user_id || !winner?.ai_client_secret) throw new Error('绑定AI账户失败');
  return {
    ok: true,
    userId: winner.ai_user_id,
    clientSecret: winner.ai_client_secret,
    existing: true,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return reply(req, { ok: false, error: '只支持POST请求' }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) return reply(req, { ok: false, error: '授权服务未配置' }, 503);
  try {
    requestOrigin(req);
    const body = await req.json() as JsonMap;
    const action = cleanText(body.action, 48);
    let result: JsonMap;
    if (action === 'activate') result = await activateInvite(req, body);
    else if (action === 'legacy_activate') result = await activateLegacy(req, body);
    else if (action === 'register_options') result = await registrationOptions(req, body);
    else if (action === 'register_verify') result = await registrationVerify(req, body);
    else if (action === 'restore_options') result = await authenticationOptions(req);
    else if (action === 'restore_verify') result = await authenticationVerify(req, body);
    else if (action === 'session_check') result = await checkSession(body);
    else if (action === 'session_list') result = await listSessions(body);
    else if (action === 'session_revoke') result = await revokeSession(body);
    else if (action === 'transfer_create') result = await createTransfer(req, body);
    else if (action === 'transfer_redeem') result = await redeemTransfer(req, body);
    else if (action === 'ai_identity_sync') result = await syncAIIdentity(body);
    else throw new Error('未知的授权操作');
    return reply(req, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '授权操作失败';
    console.error('phone-license', message);
    const status = /频繁|尝试过多|稍后再试/.test(message) ? 429 : /无效|失效|过期|没有|缺少|校验|已经|请输入/.test(message) ? 400 : 500;
    return reply(req, { ok: false, error: message }, status);
  }
});
