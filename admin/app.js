const API_URL = 'https://lkhlyfpssmrjkkzhuzag.supabase.co/functions/v1/phone-ai';
const PUBLIC_KEY = 'sb_publishable_uKytf2Tc_FmLv15SkkJyCQ_VU8IRSt2';
const TOKEN_KEY = 'north_admin_access';

let token = localStorage.getItem(TOKEN_KEY) || '';
let adminAccessRole = '';
let scope = 'pending';
let workspaceView = 'orders';
let orders = [];
let licenseUsers = [];
let licenseTotal = 0;
let licensePage = 1;
const licensePageSize = 50;
let licenseQuery = '';
let licenseStatus = 'all';
let licenseSearchTimer = 0;
let loadingOrders = false;
let loadingLicenses = false;
let licenseReloadQueued = false;
let actionBusy = false;
let consecutiveAuthFailures = 0;
let installPrompt = null;
let pollTimer = 0;
const collapsedOrders = new Set();
const seenOrders = new Set();

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shortId = (value) => String(value || '').replace(/-/g, '').slice(0, 10).toUpperCase();
const fmtTime = (value) => {
  if (!value) return '未填写';
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toLocaleString('zh-CN', {hour12:false}) : String(value);
};
const fmtDateTime = (value) => {
  const d = new Date(value || 0);
  if (!Number.isFinite(d.getTime())) return '未知';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const stateLabel = (order) => order.status === 'paid' ? '已确认' : order.review_status === 'rejected' ? '已驳回' : order.review_status === 'submitted' ? '待核对' : '未提交';
const providerLabel = (provider) => provider === 'wechat' ? '微信' : '支付宝';
const operatorLabel = (value) => {
  const operator = String(value || '');
  if (operator === 'owner') return '主管理员';
  const numbered = operator.match(/^(?:admin|license)-(\d+)$/);
  return numbered ? `管理员${Number(numbered[1])}` : '旧记录';
};

async function api(action, payload = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: PUBLIC_KEY,
        Authorization: 'Bearer ' + PUBLIC_KEY,
        'x-admin-token': token,
      },
      body: JSON.stringify({action, ...payload}),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.ok === false) {
      const error = new Error((data && data.error) || ('HTTP ' + response.status));
      error.status = response.status;
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function setStatus(text) {
  $('statusText').textContent = text;
}

function showAuth(message = '') {
  clearTimeout(pollTimer);
  adminAccessRole = '';
  $('workspace').classList.add('hidden');
  $('auth').classList.remove('hidden');
  $('adminToken').value = token;
  if (message) {
    $('loginBtn').textContent = message;
    setTimeout(() => $('loginBtn').textContent = '进入核对台', 1800);
  }
}

function showWorkspace(role) {
  consecutiveAuthFailures = 0;
  adminAccessRole = role === 'license' ? 'license' : 'owner';
  $('auth').classList.add('hidden');
  $('workspace').classList.remove('hidden');
  const licenseOnly = adminAccessRole === 'license';
  document.querySelectorAll('[data-owner-only]').forEach((item) => item.classList.toggle('hidden', licenseOnly));
  if (licenseOnly) openLicenseView();
  else openOrdersView(scope);
  schedulePoll();
}

function schedulePoll() {
  clearTimeout(pollTimer);
  if (!adminAccessRole) return;
  pollTimer = setTimeout(async () => {
    if (workspaceView === 'licenses') await loadLicenseUsers(false);
    else await loadOrders(false);
    if (adminAccessRole) schedulePoll();
  }, 15000);
}

function handleAuthFailure() {
  consecutiveAuthFailures += 1;
  if (consecutiveAuthFailures < 3) {
    setStatus(`授权连接短暂中断，正在自动重试（${consecutiveAuthFailures}/3）…`);
    return;
  }
  showAuth('授权已变化，请重新进入');
}

function renderOrders() {
  const root = $('orders');
  if (!orders.length) {
    root.innerHTML = `<div class="empty">${scope === 'pending' ? '目前没有待核对订单' : '还没有订单记录'}</div>`;
    return;
  }
  root.innerHTML = orders.map((order) => {
    const service = order.plan_id === 'svc_clone_1990' || Number(order.points || 0) === 0;
    const folded = collapsedOrders.has(String(order.id));
    const reviewable = order.status === 'pending' && order.review_status === 'submitted';
    const voice = order.private_voice || null;
    const canAssignVoice = service && order.status === 'paid' && order.review_status === 'approved';
    return `<article class="order ${reviewable ? 'pending' : ''}" id="order-${esc(order.id)}">
      <div class="order-head">
        <button class="fold-head" type="button" onclick="toggleOrderFold('${esc(order.id)}')" aria-expanded="${folded ? 'false' : 'true'}">
          <span class="fold-icon">${folded ? '›' : '⌄'}</span>
          <span class="fold-main">
            <span class="order-title">${esc(providerLabel(order.provider))} ¥${Number(order.amount_cny || 0).toFixed(2)} · ${service ? '音色克隆' : Number(order.points || 0).toLocaleString() + ' 点'}</span>
            <span class="sub">订单 ${esc(shortId(order.id))}</span>
          </span>
        </button>
        <div class="order-state">${esc(stateLabel(order))}</div>
      </div>
      <div class="order-body ${folded ? 'hidden' : ''}">
        <div class="meta">
          <div><b>AI 用户 ID</b>${esc(order.user_id)}</div>
          <div><b>账户当前点数</b>${Number(order.account_points || 0).toLocaleString()}</div>
          <div><b>用户填写付款时间</b>${esc(fmtTime(order.claimed_paid_at))}</div>
          <div><b>付款昵称或尾号</b>${esc(order.payer_hint || '未填写')}</div>
          <div><b>提交时间</b>${esc(fmtTime(order.review_submitted_at))}</div>
          <div><b>审核说明</b>${esc(order.review_note || '无')}</div>
          ${service ? `<div><b>专属音色</b>${voice ? `${esc(voice.display_name)}<br><span class="sub">${esc(voice.voice_id)}</span>` : '尚未绑定'}</div>` : ''}
        </div>
        ${order.proof_url ? `<button class="proof-btn" onclick="openProof('${esc(order.proof_url)}')"><img class="proof" src="${esc(order.proof_url)}" alt="付款截图"></button>` : '<div class="sub">没有付款截图</div>'}
        <div class="actions">
          ${reviewable ? `<button class="btn danger" onclick="openReject('${esc(order.id)}')">驳回</button><button class="btn approve" onclick="openApprove('${esc(order.id)}')">${service ? '确认付款到账' : '确认到账并加点'}</button>` : ''}
          ${canAssignVoice ? `<button class="btn approve" onclick="openAssignVoice('${esc(order.id)}')">${voice ? '更换专属音色' : '绑定专属音色'}</button>` : ''}
          <button class="btn danger wide-hit" onclick="openDeleteOrder('${esc(order.id)}')">删除记录</button>
        </div>
      </div>
    </article>`;
  }).join('');
}

function renderLicenseUsers() {
  const root = $('licenseUsers');
  const rows = licenseUsers;
  if (!rows.length) {
    const filtered = licenseQuery || licenseStatus !== 'all';
    root.innerHTML = `<div class="empty">${filtered ? '当前搜索或状态下没有用户' : '还没有邀请码核销记录'}</div>`;
    return;
  }
  root.innerHTML = rows.map((user) => {
    const active = user.status === 'active';
    const phoneId = user.phone_friend_id || '待同步小手机 ID';
    const actionLabel = user.phone_friend_id || shortId(user.id);
    return `<article class="order">
      <div class="order-head">
        <div>
          <div class="license-id">${esc(phoneId)}</div>
          <div class="sub">授权编号 ${esc(shortId(user.id))}</div>
        </div>
        <span class="license-state ${active ? '' : 'blocked'}">${active ? '可进入' : '已移出'}</span>
      </div>
      <div class="meta">
        <div><b>注册时间</b>${esc(fmtDateTime(user.created_at))}</div>
        <div><b>最近使用</b>${esc(user.last_seen_at ? fmtDateTime(user.last_seen_at) : '尚无记录')}</div>
        <div><b>小手机 ID</b>${esc(user.phone_friend_id || '旧版本尚未补齐')}</div>
        <div><b>AI 用户 ID</b>${esc(user.ai_user_id || '尚未绑定')}</div>
        <div><b>使用邀请码</b>${esc(user.invite_code_hint || '旧记录未保存')}</div>
        ${user.last_admin_action ? `<div><b>最近管理操作</b>${esc(operatorLabel(user.last_admin_operator))} · ${user.last_admin_action === 'block' ? '移出' : '放回'} · ${esc(fmtDateTime(user.last_admin_action_at))}</div>` : ''}
      </div>
      <div class="actions">
        ${active ? `<button class="btn danger" onclick="openBlockLicense('${esc(user.id)}','${esc(actionLabel)}')">移出去</button>` : ''}
        <button class="btn approve" onclick="openRecoverLicense('${esc(user.id)}','${esc(actionLabel)}',${active ? 'false' : 'true'})">${active ? '生成恢复码' : '放进来并生成恢复码'}</button>
      </div>
    </article>`;
  }).join('');
}

function renderLicensePager() {
  const totalPages = Math.max(1, Math.ceil(licenseTotal / licensePageSize));
  $('licenseCount').textContent = licenseTotal;
  $('licenseResultText').textContent = licenseTotal
    ? `共 ${licenseTotal.toLocaleString()} 人 · 本页 ${licenseUsers.length} 人`
    : '共 0 人';
  $('licensePageText').textContent = `第 ${licensePage.toLocaleString()} / ${totalPages.toLocaleString()} 页`;
  $('licensePrevBtn').disabled = licensePage <= 1 || loadingLicenses;
  $('licenseNextBtn').disabled = licensePage >= totalPages || loadingLicenses;
}

async function loadLicenseUsers(showLoading) {
  if (loadingLicenses) {
    licenseReloadQueued = true;
    return;
  }
  loadingLicenses = true;
  licenseReloadQueued = false;
  const requestedPage = licensePage;
  const requestedQuery = licenseQuery;
  const requestedStatus = licenseStatus;
  if (showLoading) $('licenseUsers').innerHTML = '<div class="empty"><div class="spinner"></div>正在读取当前页用户</div>';
  renderLicensePager();
  setStatus('正在从云端搜索用户授权…');
  try {
    const data = await api('admin_license_users', {
      page: requestedPage,
      page_size: licensePageSize,
      query: requestedQuery,
      status: requestedStatus,
    });
    if (
      requestedPage !== licensePage ||
      requestedQuery !== licenseQuery ||
      requestedStatus !== licenseStatus
    ) {
      licenseReloadQueued = true;
      return;
    }
    licenseTotal = Math.max(0, Number(data.total || 0));
    const totalPages = Math.max(1, Math.ceil(licenseTotal / licensePageSize));
    if (licensePage > totalPages) {
      licensePage = totalPages;
      licenseReloadQueued = true;
      return;
    }
    licenseUsers = Array.isArray(data.users) ? data.users : [];
    consecutiveAuthFailures = 0;
    renderLicenseUsers();
    setStatus('用户授权已同步 · ' + new Date().toLocaleTimeString('zh-CN', {hour12:false}));
  } catch (error) {
    if (error.status === 401 || /admin-unauthorized/i.test(error.message)) {
      handleAuthFailure();
    } else {
      setStatus('用户授权读取失败：' + error.message);
      if (showLoading) $('licenseUsers').innerHTML = '<div class="empty">暂时无法读取用户记录</div>';
    }
  } finally {
    loadingLicenses = false;
    renderLicensePager();
    if (licenseReloadQueued) {
      licenseReloadQueued = false;
      loadLicenseUsers(true);
    }
  }
}

function openLicenseView() {
  workspaceView = 'licenses';
  $('orders').classList.add('hidden');
  $('licensePanel').classList.remove('hidden');
  $('deleteAllBtn').classList.add('hidden');
  document.querySelectorAll('.tab[data-scope]').forEach((item) => item.classList.remove('on'));
  $('licenseTab').classList.add('on');
  loadLicenseUsers(true);
}

function openOrdersView(nextScope) {
  if (adminAccessRole === 'license') return;
  workspaceView = 'orders';
  scope = nextScope || scope;
  $('orders').classList.remove('hidden');
  $('licensePanel').classList.add('hidden');
  $('deleteAllBtn').classList.remove('hidden');
  $('licenseTab').classList.remove('on');
  document.querySelectorAll('.tab[data-scope]').forEach((item) => item.classList.toggle('on', item.dataset.scope === scope));
  loadOrders(true);
}

window.openBlockLicense = (id, phoneId) => {
  openSheet(`<h2>移出 ${esc(phoneId)}</h2>
    <p>移出后，这个用户的全部浏览器授权、扫脸/指纹通行密钥和恢复码都会失效。聊天和本机存档不会被后台删除。</p>
    <div class="sheet-actions"><button class="btn" onclick="closeSheet()">取消</button><button class="btn danger" id="licenseActionBtn" onclick="confirmBlockLicense('${esc(id)}')">确认移出</button></div>`);
};

window.confirmBlockLicense = async (id) => {
  if (actionBusy) return;
  actionBusy = true;
  const button = $('licenseActionBtn');
  if (button) { button.disabled = true; button.textContent = '正在移出…'; }
  try {
    await api('admin_license_block', {license_id:id});
    closeSheet();
    await loadLicenseUsers(false);
  } catch (error) {
    alert('移出失败：' + error.message);
  } finally {
    actionBusy = false;
  }
};

window.openRecoverLicense = (id, phoneId, blocked) => {
  openSheet(`<h2>${blocked ? '放进来' : '生成恢复码'} · ${esc(phoneId)}</h2>
    <p>${blocked ? '系统会重新启用这条授权，' : ''}并生成一个 24 小时有效、只能使用一次的管理员恢复码。把号码私下发给本人，让对方在登录页选择“迁移码 / 备用恢复码”进入。</p>
    <div class="sheet-actions"><button class="btn" onclick="closeSheet()">取消</button><button class="btn approve" id="licenseActionBtn" onclick="confirmRecoverLicense('${esc(id)}')">生成号码</button></div>`);
};

window.confirmRecoverLicense = async (id) => {
  if (actionBusy) return;
  actionBusy = true;
  const button = $('licenseActionBtn');
  if (button) { button.disabled = true; button.textContent = '正在生成…'; }
  try {
    const data = await api('admin_license_recovery', {license_id:id});
    await loadLicenseUsers(false);
    openSheet(`<h2>一次性管理员恢复码</h2>
      <p>24 小时内有效，只能使用一次。请私下发给对应用户；生成下一枚恢复码后，这一枚会失效。</p>
      <input class="recovery-code" id="adminRecoveryCode" readonly value="${esc(data.code || '')}">
      <div class="sheet-actions"><button class="btn" onclick="closeSheet()">关闭</button><button class="btn approve" onclick="copyAdminRecoveryCode()">复制号码</button></div>`);
  } catch (error) {
    alert('生成失败：' + error.message);
  } finally {
    actionBusy = false;
  }
};

window.copyAdminRecoveryCode = async () => {
  const input = $('adminRecoveryCode');
  const value = String(input && input.value || '');
  let copied = false;
  try {
    await navigator.clipboard.writeText(value);
    copied = true;
  } catch (_) {
    try { input.focus(); input.select(); copied = !!document.execCommand('copy'); } catch (_) {}
  }
  alert(copied ? '恢复码已复制' : '请长按号码手动复制');
};

async function loadOrders(showLoading) {
  if (adminAccessRole === 'license') return;
  if (loadingOrders) return;
  loadingOrders = true;
  if (showLoading) $('orders').innerHTML = '<div class="empty"><div class="spinner"></div>正在读取订单</div>';
  setStatus('正在同步…');
  try {
    const data = await api('admin_orders', {scope});
    orders = Array.isArray(data.orders) ? data.orders : [];
    consecutiveAuthFailures = 0;
    orders.forEach((order) => {
      const id = String(order && order.id || '');
      if (id && !seenOrders.has(id)) {
        collapsedOrders.add(id);
        seenOrders.add(id);
      }
    });
    $('pendingCount').textContent = Number(data.pending_count || 0);
    renderOrders();
    setStatus('已同步 · ' + new Date().toLocaleTimeString('zh-CN', {hour12:false}));
    const target = new URLSearchParams(location.search).get('order');
    if (target) setTimeout(() => document.getElementById('order-' + target)?.scrollIntoView({behavior:'smooth', block:'center'}), 120);
  } catch (error) {
    if (error.status === 401 || /admin-unauthorized/i.test(error.message)) {
      handleAuthFailure();
    } else {
      setStatus('同步失败：' + error.message);
      if (showLoading) $('orders').innerHTML = '<div class="empty">暂时无法读取订单，请检查网络后刷新</div>';
    }
  } finally {
    loadingOrders = false;
  }
}

function openSheet(html) {
  $('sheet').innerHTML = html;
  $('modal').classList.remove('hidden');
}

function closeSheet() {
  $('modal').classList.add('hidden');
}

window.toggleOrderFold = (id) => {
  const sid = String(id || '');
  if (!sid) return;
  if (collapsedOrders.has(sid)) collapsedOrders.delete(sid);
  else collapsedOrders.add(sid);
  renderOrders();
};

window.openProof = (url) => {
  $('viewerImg').src = url;
  $('viewer').classList.remove('hidden');
};

window.openApprove = (id) => {
  const order = orders.find((item) => item.id === id);
  if (!order) return;
  const service = order.plan_id === 'svc_clone_1990' || Number(order.points || 0) === 0;
  openSheet(`<h2>确认实际到账</h2>
    <p>请先在微信或支付宝账单中核对金额、时间和付款人。${service ? '确认后可在这笔订单中绑定客户的专属音色。' : `确认后，${Number(order.points || 0).toLocaleString()} 点会立刻进入 AI 账户 <b>${esc(order.user_id)}</b>。`}</p>
    <label class="field"><span>真实交易单号或账单尾号（必填）</span><input id="paymentRef" maxlength="120" placeholder="用于防止同一笔付款重复加点"></label>
    <div class="sheet-actions"><button class="btn" onclick="closeSheet()">取消</button><button class="btn approve" onclick="reviewOrder('${esc(id)}','approve')">确认到账</button></div>`);
};

window.openAssignVoice = (id) => {
  const order = orders.find((item) => item.id === id);
  if (!order) return;
  const voice = order.private_voice || {};
  openSheet(`<h2>绑定客户专属音色</h2>
    <p>只填写已经在当前 MiniMax 账户中克隆成功的音色。保存后，只有这笔订单所属的 AI 账户可以使用；客户刷新 AI 账户即可看到。</p>
    <label class="field"><span>客户看到的音色名称</span><input id="privateVoiceName" maxlength="60" value="${esc(voice.display_name || '')}" placeholder="例如：先生专属音色"></label>
    <label class="field"><span>MiniMax voice_id</span><input id="privateVoiceId" maxlength="256" value="${esc(voice.voice_id || '')}" placeholder="例如：customerVoice01"></label>
    <div class="sub">系统会先核对该 voice_id 是否属于当前 MiniMax 账户，不会通过试听触发额外克隆费用。</div>
    <div class="sheet-actions"><button class="btn" onclick="closeSheet()">取消</button><button id="assignVoiceBtn" class="btn approve" onclick="assignPrivateVoice('${esc(id)}')">保存专属音色</button></div>`);
};

window.openReject = (id) => {
  openSheet(`<h2>驳回付款申请</h2>
    <p>驳回后不会加点。用户会在 AI 账户订单里看到原因，需要重新创建订单再提交。</p>
    <label class="field"><span>原因</span><textarea id="rejectNote" maxlength="300" placeholder="例如：未在账单中查到、金额不一致、截图不清晰"></textarea></label>
    <div class="sheet-actions"><button class="btn" onclick="closeSheet()">取消</button><button class="btn danger" onclick="reviewOrder('${esc(id)}','reject')">确认驳回</button></div>`);
};

window.openDeleteOrder = (id) => {
  const order = orders.find((item) => item.id === id);
  if (!order) return;
  openSheet(`<h2>删除订单记录</h2>
    <p>这只会从核对后台和用户订单列表里移除这条记录，并删除对应付款截图。已经确认到账的点数不会被扣回。</p>
    <p>订单 <b>${esc(shortId(order.id))}</b> · ${esc(providerLabel(order.provider))} ¥${Number(order.amount_cny || 0).toFixed(2)}</p>
    <div class="sheet-actions"><button class="btn" onclick="closeSheet()">取消</button><button id="deleteOneBtn" class="btn danger" onclick="deleteOrder('${esc(id)}')">确认删除</button></div>`);
};

window.openDeleteAllOrders = () => {
  if (!orders.length) {
    alert('当前没有可以删除的订单');
    return;
  }
  const label = scope === 'pending' ? '当前待核对订单' : '全部订单记录';
  openSheet(`<h2>一键删除${label}</h2>
    <p>会删除当前列表里的订单记录和付款截图。已经确认到账的点数不会被扣回。</p>
    <p>本次将删除 <b>${orders.length}</b> 条记录。</p>
    <div class="sheet-actions"><button class="btn" onclick="closeSheet()">取消</button><button id="deleteAllConfirmBtn" class="btn danger" onclick="deleteAllOrders()">确认删除全部</button></div>`);
};

window.closeSheet = closeSheet;

window.reviewOrder = async (id, decision) => {
  if (actionBusy) return;
  const paymentRef = ($('paymentRef') && $('paymentRef').value || '').trim();
  const reviewNote = ($('rejectNote') && $('rejectNote').value || '').trim();
  if (decision === 'approve' && paymentRef.length < 4) {
    $('paymentRef').focus();
    return;
  }
  if (decision === 'reject' && reviewNote.length < 2) {
    $('rejectNote').focus();
    return;
  }
  actionBusy = true;
  try {
    await api('admin_review', {purchase_id:id, decision, payment_ref:paymentRef, review_note:reviewNote});
    closeSheet();
    await loadOrders(true);
  } catch (error) {
    alert('处理失败：' + error.message);
  } finally {
    actionBusy = false;
  }
};

window.assignPrivateVoice = async (id) => {
  if (actionBusy) return;
  const voiceId = ($('privateVoiceId') && $('privateVoiceId').value || '').trim();
  const displayName = ($('privateVoiceName') && $('privateVoiceName').value || '').trim();
  if (!displayName) {
    $('privateVoiceName').focus();
    return;
  }
  if (!/^[A-Za-z][A-Za-z0-9_-]{6,254}[A-Za-z0-9]$/.test(voiceId)) {
    alert('voice_id 必须为 8～256 位，以英文字母开头，只能包含字母、数字、-、_，结尾不能是 - 或 _。');
    $('privateVoiceId').focus();
    return;
  }
  actionBusy = true;
  const btn = $('assignVoiceBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '正在核对并绑定…';
  }
  try {
    await api('admin_assign_private_voice', {
      purchase_id: id,
      voice_id: voiceId,
      display_name: displayName,
    });
    closeSheet();
    await loadOrders(true);
  } catch (error) {
    alert('绑定失败：' + error.message);
  } finally {
    actionBusy = false;
  }
};

window.deleteOrder = async (id) => {
  if (actionBusy) return;
  actionBusy = true;
  const btn = $('deleteOneBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '删除中…';
  }
  try {
    await api('admin_delete_order', {purchase_id:id});
    closeSheet();
    collapsedOrders.delete(String(id));
    orders = orders.filter((item) => item.id !== id);
    renderOrders();
    await loadOrders(false);
  } catch (error) {
    alert('删除失败：' + error.message);
  } finally {
    actionBusy = false;
  }
};

window.deleteAllOrders = async () => {
  if (actionBusy) return;
  actionBusy = true;
  const btn = $('deleteAllConfirmBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '删除中…';
  }
  try {
    await api('admin_delete_orders', {scope});
    closeSheet();
    collapsedOrders.clear();
    seenOrders.clear();
    orders = [];
    renderOrders();
    await loadOrders(false);
  } catch (error) {
    alert('删除失败：' + error.message);
  } finally {
    actionBusy = false;
  }
};

async function login() {
  const supplied = $('adminToken').value.trim();
  if (!supplied) return;
  token = supplied;
  $('loginBtn').disabled = true;
  $('loginBtn').textContent = '正在验证…';
  try {
    const result = await api('admin_auth');
    localStorage.setItem(TOKEN_KEY, token);
    showWorkspace(result.role);
  } catch (_) {
    token = '';
    localStorage.removeItem(TOKEN_KEY);
    showAuth('授权码无效');
  } finally {
    $('loginBtn').disabled = false;
  }
}

function urlBase64ToBytes(value) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const raw = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

async function enableNotifications() {
  if (adminAccessRole !== 'owner') return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    alert('当前浏览器不支持后台通知。iPhone 请先用 Safari 添加到主屏幕后再打开。');
    return;
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('没有获得通知权限');
    const registration = await navigator.serviceWorker.register('./sw.js?v=631', {scope:'./'});
    await navigator.serviceWorker.ready;
    const config = await api('admin_config');
    if (!config.vapid_public_key) throw new Error('后台通知密钥尚未配置');
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBytes(config.vapid_public_key),
      });
    }
    await api('admin_subscribe', {subscription:subscription.toJSON(), user_agent:navigator.userAgent});
    $('notifyBtn').textContent = '通知已开';
    alert('新付款申请会推送到这台设备。');
  } catch (error) {
    alert('开启通知失败：' + error.message);
  }
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
  $('installBtn').classList.remove('hidden');
});

$('installBtn').addEventListener('click', async () => {
  if (installPrompt) {
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
  } else {
    alert('iPhone 请点 Safari 分享按钮，再选“添加到主屏幕”。');
  }
});
$('loginBtn').addEventListener('click', login);
$('adminToken').addEventListener('keydown', (event) => { if (event.key === 'Enter') login(); });
$('refreshBtn').addEventListener('click', () => workspaceView === 'licenses' ? loadLicenseUsers(true) : loadOrders(true));
$('licenseRefreshBtn').addEventListener('click', () => loadLicenseUsers(true));
$('licenseSearch').addEventListener('input', () => {
  clearTimeout(licenseSearchTimer);
  licenseQuery = String($('licenseSearch').value || '').trim();
  licensePage = 1;
  licenseSearchTimer = setTimeout(() => loadLicenseUsers(true), 350);
});
$('licenseSearch').addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  clearTimeout(licenseSearchTimer);
  licenseQuery = String($('licenseSearch').value || '').trim();
  licensePage = 1;
  loadLicenseUsers(true);
});
$('licenseStatus').addEventListener('change', () => {
  licenseStatus = String($('licenseStatus').value || 'all');
  licensePage = 1;
  loadLicenseUsers(true);
});
$('licensePrevBtn').addEventListener('click', () => {
  if (licensePage <= 1 || loadingLicenses) return;
  licensePage -= 1;
  loadLicenseUsers(true);
});
$('licenseNextBtn').addEventListener('click', () => {
  const totalPages = Math.max(1, Math.ceil(licenseTotal / licensePageSize));
  if (licensePage >= totalPages || loadingLicenses) return;
  licensePage += 1;
  loadLicenseUsers(true);
});
$('licenseTab').addEventListener('click', openLicenseView);
$('notifyBtn').addEventListener('click', enableNotifications);
$('deleteAllBtn')?.addEventListener('click', openDeleteAllOrders);
$('logoutBtn').addEventListener('click', () => {
  token = '';
  localStorage.removeItem(TOKEN_KEY);
  showAuth();
});
$('modal').addEventListener('click', (event) => { if (event.target === $('modal')) closeSheet(); });
$('closeViewer').addEventListener('click', () => $('viewer').classList.add('hidden'));
document.querySelectorAll('.tab[data-scope]').forEach((button) => button.addEventListener('click', () => {
  collapsedOrders.clear();
  seenOrders.clear();
  openOrdersView(button.dataset.scope);
}));

async function restoreSavedLogin() {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await api('admin_auth');
      showWorkspace(result.role);
      return;
    } catch (_) {
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 900));
    }
  }
  showAuth('请重新进入');
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js?v=631', {scope:'./'}).catch(() => {});
if (token) restoreSavedLogin();
else showAuth();
