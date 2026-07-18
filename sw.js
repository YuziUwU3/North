const SHELL_CACHE='north-shell-v563';
const SHELL_FILES=['./','./小手机.html','./app.js','./ai-account.js','./icon.png','./pay-assets/alipay-receive.jpg','./pay-assets/wechat-receive.jpg','./pay-assets/wechat-contact.jpg'];
self.addEventListener('install',event=>{event.waitUntil((async()=>{const c=await caches.open(SHELL_CACHE);await Promise.all(SHELL_FILES.map(u=>fetch(u,{cache:'no-cache'}).then(r=>{if(r.ok)return c.put(u,r.clone());}).catch(()=>null)));await self.skipWaiting();})());});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const ks=await caches.keys();await Promise.all(ks.filter(k=>k.indexOf('north-shell-')===0&&k!==SHELL_CACHE).map(k=>caches.delete(k)));await self.clients.claim();})());});

/* 安卓网络抖动时优先取新文件，失败就退回上一次可用版本，避免脚本没加载只剩黑屏。 */
self.addEventListener('fetch',event=>{const req=event.request;if(req.method!=='GET')return;let u;try{u=new URL(req.url);}catch(_){return;}if(u.origin!==self.location.origin)return;
  if(req.mode==='navigate'){event.respondWith((async()=>{const navKey=/\/(?:index\.html)?$/.test(u.pathname)?'./':'./小手机.html';try{const r=await fetch(req);if(r&&r.ok){const c=await caches.open(SHELL_CACHE);c.put(navKey,r.clone()).catch(()=>{});return r;}}catch(_){}return(await caches.match(navKey))||(await caches.match('./小手机.html'))||(await caches.match('./'))||new Response('<meta charset="utf-8"><body style="background:#111;color:#eee;font-family:sans-serif;padding:30px;text-align:center">网络暂时不可用，请联网后重新打开小手机。</body>',{headers:{'Content-Type':'text/html;charset=utf-8'}});})());return;}
  if(/\/(app\.js|ai-account\.js|icon\.png)$/.test(u.pathname)){event.respondWith((async()=>{try{const r=await fetch(req,{cache:'no-cache'});if(r&&r.ok){const c=await caches.open(SHELL_CACHE);c.put(req,r.clone()).catch(()=>{});return r;}}catch(_){}return(await caches.match(req,{ignoreSearch:true}))||Response.error();})());}
});

function openUrlFor(data){
  const base=new URL('\u5c0f\u624b\u673a.html',self.registration.scope);
  if(data&&data.target==='chat'&&data.id)base.hash='chat='+encodeURIComponent(data.id);
  else if(data&&data.target==='group'&&data.id)base.hash='group='+encodeURIComponent(data.id);
  else if(data&&data.target==='call')base.hash='call';
  else if(data&&data.target==='mail')base.hash='mail';
  else if(data&&data.target==='x')base.hash='x';
  return base.href;
}

self.addEventListener('notificationclick',event=>{
  const data=event.notification&&event.notification.data||{};
  event.notification.close();
  event.waitUntil((async()=>{
    const list=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of list){
      if('focus'in client){
        try{client.postMessage(Object.assign({type:'open'},data));}catch(e){}
        return client.focus();
      }
    }
    if(self.clients.openWindow)return self.clients.openWindow(openUrlFor(data));
  })());
});
