const CACHE_NAME='hoc-pro-v3';
const QUOTES=[
  "Get up and be somebody. No one is coming to save you.",
  "The man who goes to the gym every day regardless of how he feels will beat the man who only goes when he feels like it.",
  "Your mind must be stronger than your feelings.",
  "Do the hard things first. Weakness is a choice.",
  "Speed is extremely important. Act faster than everyone else.",
  "Opportunities multiply as they are seized.",
  "Victorious warriors win first, then go to war.",
  "In the midst of chaos, there is also opportunity.",
  "Power is not given. It is taken.",
  "Execution is the game. Everything else is commentary.",
  "The cost of inaction is greater than the cost of any mistake.",
  "Every second you waste is a second someone else is using against you.",
  "Discipline is the bridge between goals and accomplishment.",
  "Stop waiting for the perfect moment. Attack.",
  "Work in silence. Let the money make the noise.",
];
function randQuote(){return QUOTES[Math.floor(Math.random()*QUOTES.length)];}
function p2(n){return String(n).padStart(2,'0');}
function todayStr(){const d=new Date();return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());}

let notifInterval=null;
let taskData={tasks:[],settings:{repeatInterval:30,eodTime:'18:00'},mitId:null};

// Read from cache store we set via postMessage
self.addEventListener('message',e=>{
  if(e.data&&e.data.type==='INIT'){self.__HOC_ICON__=e.data.icon||'';}
  if(e.data&&e.data.type==='SYNC_TASKS'){
    taskData=e.data.payload;
    // Restart interval with new settings
    startNotifInterval();
  }
  if(e.data&&e.data.type==='FIRE_NOW'){
    runChecks();
  }
  if(e.data&&e.data.type==='PING'){
    runChecks();
  }
});

function startNotifInterval(){
  if(notifInterval)clearInterval(notifInterval);
  const mins=parseInt(taskData.settings.repeatInterval)||30;
  notifInterval=setInterval(runChecks,mins*60*1000);
}

function isOv(t){
  if(t.done||!t.dueDate)return false;
  return new Date(t.dueDate+(t.dueTime?'T'+t.dueTime:'T23:59'))<new Date();
}
function isTd(t){return t.dueDate===todayStr();}

function runChecks(){
  if(Notification.permission!=='granted')return;
  const now=new Date();
  const nowMin=now.getHours()*60+now.getMinutes();
  const td=todayStr();
  const tasks=taskData.tasks||[];
  const repeatMins=parseInt(taskData.settings.repeatInterval)||30;
  const slot=Math.floor(now.getTime()/(repeatMins*60*1000));

  // 1. Due-now: fire exactly at scheduled time (within 1 min window)
  tasks.forEach(t=>{
    if(t.done||!t.dueDate||!t.dueTime)return;
    const dueMs=new Date(t.dueDate+'T'+t.dueTime).getTime();
    const key='sw-due-'+t.id+'-'+t.dueDate+'-'+t.dueTime;
    if(Math.abs(dueMs-now.getTime())<62000){
      getLastFired(key).then(last=>{
        if(!last){
          setLastFired(key);
          self.registration.showNotification('🔴 Due Now — '+t.name,{
            body:(t.priority==='high'?'HIGH PRIORITY':'')+(t.notes?' · '+t.notes:'')+'\n"'+randQuote()+'"',
            tag:'hoc-due-'+t.id,
            icon:self.__HOC_ICON__||'',
            badge:self.__HOC_ICON__||'',
            requireInteraction:true,
            vibrate:[200,100,200],
            data:{taskId:t.id}
          });
        }
      });
    }
  });

  // 2. Task reminders (lead-up alerts)
  tasks.forEach(t=>{
    if(t.done||!t.dueDate||!t.dueTime||!t.reminders||!t.reminders.length)return;
    const dueMs=new Date(t.dueDate+'T'+t.dueTime).getTime();
    t.reminders.forEach(r=>{
      const key='sw-rem-'+t.id+'-'+r.offsetMins;
      const fireMs=dueMs-(r.offsetMins*60*1000);
      if(Math.abs(fireMs-now.getTime())<62000){
        getLastFired(key).then(last=>{
          if(!last){
            setLastFired(key);
            const fmtOffset=r.offsetMins<60?r.offsetMins+' min':(r.offsetMins/60)+'h';
            self.registration.showNotification('⏰ '+t.name,{
              body:(r.note||fmtOffset+' until due')+'\n"'+randQuote()+'"',
              tag:'hoc-rem-'+t.id+'-'+r.offsetMins,
              icon:self.__HOC_ICON__||'',
              badge:self.__HOC_ICON__||'',
              requireInteraction:true,
              vibrate:[100,50,100],
              data:{taskId:t.id}
            });
          }
        });
      }
    });
  });

  // 3. Periodic nudge for open tasks (every N min until done)
  const repKey='sw-repeat-'+slot;
  getLastFired(repKey).then(last=>{
    if(!last){
      const pending=tasks.filter(t=>!t.done&&(isTd(t)||isOv(t)));
      if(pending.length>0){
        setLastFired(repKey);
        const mit=taskData.mitId?tasks.find(t=>t.id===taskData.mitId&&!t.done):null;
        const names=pending.slice(0,3).map(t=>t.name).join(', ')+(pending.length>3?' +more':'');
        self.registration.showNotification('📌 '+pending.length+' open task'+(pending.length!==1?'s':'')+' — HOC PRO',{
          body:(mit?'MIT: '+mit.name+'\n':'')+names+'\n"'+randQuote()+'"',
          tag:'hoc-nudge-'+slot,
          icon:self.__HOC_ICON__||'',
          badge:self.__HOC_ICON__||'',
          requireInteraction:false,
          vibrate:[100,50,100],
          actions:[{action:'open',title:'Open App'}]
        });
      }
    }
  });

  // 4. Morning brief at 9:00 AM
  const mKey='sw-morning-'+td;
  if(nowMin>=540&&nowMin<542){
    getLastFired(mKey).then(last=>{
      if(!last){
        setLastFired(mKey);
        const cnt=tasks.filter(t=>!t.done&&t.dueDate===td).length;
        const mit=taskData.mitId?tasks.find(t=>t.id===taskData.mitId&&!t.done):null;
        self.registration.showNotification('☀️ Morning Brief — HOC PRO',{
          body:(mit?'MIT: '+mit.name+' · ':'')+cnt+' tasks today.\n"'+randQuote()+'"',
          tag:'hoc-morning-'+td,
          icon:self.__HOC_ICON__||'',
          requireInteraction:false,
          vibrate:[100,50,100,50,100]
        });
      }
    });
  }

  // 5. EOD nudge
  const eodTime=taskData.settings.eodTime||'18:00';
  const[rh,rm]=eodTime.split(':').map(Number);
  const eKey='sw-eod-'+td;
  if(nowMin>=rh*60+rm&&nowMin<rh*60+rm+2){
    getLastFired(eKey).then(last=>{
      if(!last){
        setLastFired(eKey);
        const done=tasks.filter(t=>t.done&&t.doneAt&&t.doneAt.startsWith(td)).length;
        const left=tasks.filter(t=>!t.done&&(t.dueDate===td||isOv(t))).length;
        self.registration.showNotification('📋 EOD Review — HOC PRO',{
          body:done+' done · '+left+' remaining\n"'+randQuote()+'"',
          tag:'hoc-eod-'+td,
          icon:self.__HOC_ICON__||'',
          requireInteraction:true,
          vibrate:[200,100,200,100,200]
        });
      }
    });
  }

  // 6. Daily core tasks — repeat every interval until done
  const DAILY_CORE_KEYS=['hoc-core-gm','hoc-core-puzzle','hoc-core-figureout'];
  DAILY_CORE_KEYS.forEach(coreKey=>{
    const t=tasks.find(x=>x.coreKey===coreKey&&x.dueDate===td);
    if(!t||t.done)return;
    const cKey='sw-core-'+coreKey+'-'+slot;
    getLastFired(cKey).then(last=>{
      if(!last){
        setLastFired(cKey);
        self.registration.showNotification('⚡ Daily Core Undone — '+t.name,{
          body:'This must be done today. No excuses.\n"'+randQuote()+'"',
          tag:'hoc-core-'+coreKey+'-'+slot,
          icon:self.__HOC_ICON__||'',
          requireInteraction:false,
          vibrate:[200,100,200]
        });
      }
    });
  });
}

// ── Simple fired-key store using Cache API (available in SW) ──
async function getLastFired(key){
  try{
    const cache=await caches.open('hoc-fired-keys');
    const r=await cache.match('https://hoc.local/fired/'+encodeURIComponent(key));
    if(!r)return null;
    const data=await r.json();
    // Expire after 23h
    if(Date.now()-data.ts>23*60*60*1000){await cache.delete('https://hoc.local/fired/'+encodeURIComponent(key));return null;}
    return data;
  }catch{return null;}
}
async function setLastFired(key){
  try{
    const cache=await caches.open('hoc-fired-keys');
    await cache.put('https://hoc.local/fired/'+encodeURIComponent(key),new Response(JSON.stringify({ts:Date.now()})));
  }catch{}
}

self.addEventListener('install',e=>{
  e.waitUntil(self.skipWaiting());
});
self.addEventListener('activate',e=>{
  e.waitUntil(self.clients.claim());
  startNotifInterval();
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window'}).then(clients=>{
    if(clients.length)return clients[0].focus();
    return self.clients.openWindow('./');
  }));
});
// Periodic background sync (Chrome Android only, but graceful fallback)
self.addEventListener('periodicsync',e=>{
  if(e.tag==='hoc-notification-check'){
    e.waitUntil(runChecks());
  }
});
