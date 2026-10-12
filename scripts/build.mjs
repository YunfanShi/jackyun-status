import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {issueRecord} from './model.mjs';
const summary = JSON.parse(await readFile('history/summary.json','utf8'));
const checkedAt = new Date().toISOString();
const services = await Promise.all(summary.map(async s => {
  const history = await readFile('history/'+s.slug+'.yml','utf8');
  const startedAt = history.match(/^startTime:\s*(.+)$/m)?.[1];
  let status='unknown', responseTime=null, code=null;
  if (process.env.STATUS_LIVE_PROBE === '1') {
    const start=performance.now();
    try {
      const r = await fetch(s.url,{signal:AbortSignal.timeout(15000),headers:{'User-Agent':'JackYun Status/2.0'}});
      code=r.status; const body=await r.text(); responseTime=Math.round(performance.now()-start);
      const healthy = r.ok && (!s.url.endsWith('/api/health') || (()=>{try{return JSON.parse(body).status==='ok';}catch{return false;}})());
      status = !healthy ? 'down' : responseTime > 5000 ? 'degraded' : 'up';
    } catch { status='down'; }
  }
  return {name:s.name,url:s.url,slug:s.slug,status,responseTime,code,startedAt,uptimeMonth:s.uptimeMonth,uptimeWeek:s.uptimeWeek,dailyMinutesDown:s.dailyMinutesDown || {}};
}));
let incidents=[], incidentsComplete=false;
try { const saved=JSON.parse(await readFile('data/incidents.json','utf8')); incidents=saved.incidents; } catch {}
if (process.env.STATUS_FETCH_ISSUES === '1') {
  try {
    const all=[];
    for(let page=1;page<=20;page++) {
      const r=await fetch('https://api.github.com/repos/YunfanShi/jackyun-status/issues?state=all&per_page=100&page='+page,{signal:AbortSignal.timeout(20000),headers:{Accept:'application/vnd.github+json',...(process.env.GITHUB_TOKEN?{Authorization:'Bearer '+process.env.GITHUB_TOKEN}:{})}});
      if(!r.ok)throw new Error('Issue API '+r.status);
      const batch=await r.json();all.push(...batch.filter(i=>!i.pull_request));
      if(batch.length<100){incidentsComplete=true;break;}
    }
    incidents=all.map(issueRecord);
    if(process.env.STATUS_SAVE_ISSUES==='1') await writeFile('data/incidents.json',JSON.stringify({updatedAt:checkedAt,incidents},null,2));
  } catch (e) { console.warn('Incident refresh unavailable:',e.message); }
}
await mkdir('dist',{recursive:true});await cp('web','dist',{recursive:true});
await cp('scripts/model.mjs','dist/model.mjs');
await writeFile('dist/status.json',JSON.stringify({version:'2.0.0',checkedAt,probeEnabled:process.env.STATUS_LIVE_PROBE==='1',incidentsComplete,services,incidents},null,2));
await writeFile('dist/CNAME','status.jackyun.top\n');await writeFile('dist/.nojekyll','');
console.log('Built status 2.0.0: '+services.length+' services, '+incidents.length+' incidents; live probes '+(process.env.STATUS_LIVE_PROBE==='1'));
