import {overall,dailyHistory} from './model.mjs';
if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(regs=>Promise.all(regs.map(reg=>reg.unregister()))).catch(()=>{});
const $=id=>document.getElementById(id);
const names={up:'运行正常',down:'服务中断',degraded:'响应较慢',unknown:'暂未确认'};
const date=value=>new Date(value).toLocaleString('zh-CN',{hour12:false});
let data=null,limit=8,busy=false;
function el(tag,text,cls){const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;}
function incident(i){const d=el('details',null,'incident'),s=el('summary'),left=el('div');left.append(el('time',date(i.createdAt)),el('h3',i.title));s.append(left,el('span',i.state==='closed'?'已恢复':'处理中','state '+(i.state==='closed'?'':'active')));d.append(s,el('p',i.body,'incident-body'));if(i.closedAt)d.append(el('p','恢复于 '+date(i.closedAt),'note'));const a=el('a','查看报告与更新 ↗');a.href='https://github.com/YunfanShi/jackyun-status/issues/'+Number(i.id);a.target='_blank';a.rel='noopener';d.append(a);return d;}
function render(failed=false){
  const state=failed?'unknown':overall(data);document.querySelector('.overall').dataset.status=state;
  $('mark').textContent={up:'✓',down:'!',degraded:'!',unknown:'◌'}[state];
  $('overall-title').textContent={up:'所有服务运行正常',down:'部分服务出现中断',degraded:'部分服务响应较慢',unknown:failed?'暂时无法更新状态':'等待最新监控数据'}[state];
  $('overall-detail').textContent=state==='up'?'各项受监控服务目前均可正常访问。':state==='unknown'?'当前无法确认最新状态，请查看下方最近记录。':'我们正在跟踪服务状态，故障记录会在下方更新。';
  $('freshness').textContent=data?'最近检查 '+date(data.checkedAt)+(state==='unknown'?' · 数据可能已过期':'')+(!navigator.onLine?' · 当前离线':''):'状态数据读取失败，请稍后刷新。';
  if(!data)return;
  $('services').replaceChildren(...data.services.map(s=>{const block=el('article',null,'service'),head=el('div',null,'service-head'),badge=el('span',null,'badge '+(state==='unknown'?'unknown':s.status));badge.append(el('i'),document.createTextNode(names[state==='unknown'?'unknown':s.status]));head.append(el('h3',s.name),badge);const metrics=el('div',null,'metrics');for(const t of ['近 30 天可用率 '+(s.uptimeMonth || '—'),'最近响应 '+(s.responseTime===null?'—':s.responseTime+' ms')])metrics.append(el('span',t));const bars=el('div',null,'bars');bars.setAttribute('role','img');bars.setAttribute('aria-label',s.name+' 最近 90 天故障记录，绿色无故障，红色有故障，灰色未监控');const days=dailyHistory(s,new Date(data.checkedAt));for(const day of days){const b=el('span',null,'bar '+day.status);b.title=day.date+' · '+(day.status==='unknown'?'未监控':day.minutes?'故障 '+day.minutes+' 分钟':'无故障记录');bars.append(b);}const dates=el('div',null,'dates');dates.append(el('span',days[0].date),el('span','今天'));block.append(head,metrics,bars,dates);return block;}));
  const incidents=data.incidents.filter(i=>!i.maintenance).sort((a,b)=>(a.state==='open'?0:1)-(b.state==='open'?0:1)||Date.parse(b.createdAt)-Date.parse(a.createdAt));
  $('incidents').replaceChildren(...incidents.slice(0,limit).map(incident));if(!incidents.length)$('incidents').append(el('p',data.incidentsComplete?'暂时没有故障记录。':'故障历史暂时无法确认，请查看完整历史。','empty'));if(!data.incidentsComplete)$('incidents').append(el('p','故障数据尚未完整更新，以下为最近保存记录。','note'));
  $('more').hidden=limit>=incidents.length;
  const maintenance=data.incidents.filter(i=>i.maintenance&&i.state==='open');$('maintenance').replaceChildren(...maintenance.map(incident));if(!maintenance.length)$('maintenance').append(el('p',data.incidentsComplete?'目前没有计划中或进行中的维护。':'维护公告暂时无法确认，请查看 GitHub 公告。','empty'));
}
async function refresh(){if(busy)return;busy=true;$('refresh').disabled=true;try{const r=await fetch('/status.json?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error();const next=await r.json();if(!Array.isArray(next.services)||!Array.isArray(next.incidents)||!Number.isFinite(Date.parse(next.checkedAt)))throw Error();data=next;render();}catch{render(true);if(!data){$('services').replaceChildren(el('p','无法读取服务列表，请刷新重试。','empty'));$('incidents').replaceChildren(el('p','故障历史暂时不可用。','empty'));$('maintenance').replaceChildren(el('p','维护公告暂时不可用。','empty'));}}finally{busy=false;$('refresh').disabled=false;}}
$('refresh').addEventListener('click',refresh);$('more').addEventListener('click',()=>{limit+=8;render();});window.addEventListener('online',refresh);window.addEventListener('offline',()=>render(true));document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});setInterval(refresh,60000);refresh();
