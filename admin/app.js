const API_URL = 'https://lkhlyfpssmrjkkzhuzag.supabase.co/functions/v1/phone-ai';
const PUBLIC_KEY = 'sb_publishable_uKytf2Tc_FmLv15SkkJyCQ_VU8IRSt2';
const TOKEN_KEY = 'north_admin_access';

let token = localStorage.getItem(TOKEN_KEY) || '';
let scope = 'pending';
let orders = [];
let loadingOrders = false;
let actionBusy = false;
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
const stateLabel = (order) => order.status === 'paid' ? '已确认' : order.review_status === 'rejected' ? '已驳回' : order.review_status === 'submitted' ? '待核对' : '未提交';
const providerLabel = (provider) => provider === 'wechat' ? '微信' : '支付宝';

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
  $('workspace').classList.add('hidden');
  $('auth').classList.remove('hidden');
  $('adminToken').value = token;
  if (message) {
    $('loginBtn').textContent = message;
    setTimeout(() => $('loginBtn').textContent = '进入核对台', 1800);
  }
}

function showWorkspace() {
  $('auth').classList.add('hidden');
  $('workspace').classList.remove('hidden');
  loadOrders(true);
  schedulePoll();
}

function schedulePoll() {
  clearTimeout(pollTimer);
  pollTimer = setTimeout(async () => {
    await loadOrders(false);
    schedulePoll();
  }, 15000);
}

function renderOrders() {
  const root = $('orders');
  if (!orders.length) {
    root.innerHTML = `<div class="empty">${scope === 'pending' ? '目前没有待核对订单' : '还没有订单记录'}</div>`;
    return;
  }
  root.innerHTML = orders.map((order) => {
    const service = Number(order.points || 0) === 0;
    const folded = collapsedOrders.has(String(order.id));
    const reviewable = order.status === 'pending' && order.review_status === 'submitted';
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
        </div>
        ${order.proof_url ? `<button class="proof-btn" onclick="openProof('${esc(order.proof_url)}')"><img class="proof" src="${esc(order.proof_url)}" alt="付款截图"></button>` : '<div class="sub">没有付款截图</div>'}
        <div class="actions">
          ${reviewable ? `<button class="btn danger" onclick="openReject('${esc(order.id)}')">驳回</button><button class="btn approve" onclick="openApprove('${esc(order.id)}')">确认到账并加点</button>` : ''}
          <button class="btn danger wide-hit" onclick="openDeleteOrder('${esc(order.id)}')">删除记录</button>
        </div>
      </div>
    </article>`;
  }).join('');
}

async function loadOrders(showLoading) {
  if (loadingOrders) return;
  loadingOrders = true;
  if (showLoading) $('orders').innerHTML = '<div class="empty"><div class="spinner"></div>正在读取订单</div>';
  setStatus('正在同步…');
  try {
    const data = await api('admin_orders', {scope});
    orders = Array.isArray(data.orders) ? data.orders : [];
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
      token = '';
      localStorage.removeItem(TOKEN_KEY);
      showAuth('授权码无效');
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
  openSheet(`<h2>确认实际到账</h2>
    <p>请先在微信或支付宝账单中核对金额、时间和付款人。确认后，${Number(order.points || 0).toLocaleString()} 点会立刻进入 AI 账户 <b>${esc(order.user_id)}</b>。</p>
    <label class="field"><span>真实交易单号或账单尾号（必填）</span><input id="paymentRef" maxlength="120" placeholder="用于防止同一笔付款重复加点"></label>
    <div class="sheet-actions"><button class="btn" onclick="closeSheet()">取消</button><button class="btn approve" onclick="reviewOrder('${esc(id)}','approve')">确认到账</button></div>`);
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
    await api('admin_auth');
    localStorage.setItem(TOKEN_KEY, token);
    showWorkspace();
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
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    alert('当前浏览器不支持后台通知。iPhone 请先用 Safari 添加到主屏幕后再打开。');
    return;
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('没有获得通知权限');
    const registration = await navigator.serviceWorker.register('./sw.js?v=546', {scope:'./'});
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
$('refreshBtn').addEventListener('click', () => loadOrders(true));
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
  scope = button.dataset.scope;
  collapsedOrders.clear();
  seenOrders.clear();
  document.querySelectorAll('.tab[data-scope]').forEach((item) => item.classList.toggle('on', item === button));
  loadOrders(true);
}));

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js?v=546', {scope:'./'}).catch(() => {});
if (token) api('admin_auth').then(showWorkspace).catch(() => showAuth('请重新授权'));
else showAuth();
