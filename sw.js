self.addEventListener('install',event=>{self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim());});

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
