export const staleAfter = 20 * 60 * 1000;
export function overall(data, now = Date.now()) {
  if (!data || !Array.isArray(data.services) || !data.services.length || !Number.isFinite(Date.parse(data.checkedAt)) || now - Date.parse(data.checkedAt) > staleAfter || Date.parse(data.checkedAt) > now + 60000) return 'unknown';
  if (data.services.some(s => s.status === 'down')) return 'down';
  if (data.services.some(s => s.status === 'degraded')) return 'degraded';
  return data.services.every(s => s.status === 'up') ? 'up' : 'unknown';
}
export function dailyHistory(service, now = new Date()) {
  const end = new Date(now.toISOString().slice(0, 10));
  return Array.from({length:90}, (_, i) => {
    const date = new Date(end); date.setUTCDate(end.getUTCDate() - 89 + i);
    const key = date.toISOString().slice(0,10);
    const known = key >= (service.startedAt || '9999').slice(0,10);
    const minutes = Number(service.dailyMinutesDown?.[key] || 0);
    return {date:key,status:!known?'unknown':minutes>0?'down':'up',minutes};
  });
}
export function issueRecord(issue) {
  const labels = (issue.labels || []).map(l => typeof l === 'string' ? l : l.name);
  const title = issue.title.replace(/^[🛑⚠️\s]+/u,'').replace(/ is down$/,' 服务中断').replace(/ has degraded performance$/,' 响应较慢');
  const code=issue.body?.match(/HTTP code:\s*(\d+)/)?.[1];
  const response=issue.body?.match(/Response time:\s*(\d+)\s*ms/)?.[1];
  const body=code ? '监控检测到异常。HTTP 状态码 '+code+'。'+(response?'当时响应时间 '+response+' 毫秒。':'')+'完整检测记录与后续更新可在原始报告中查看。' : issue.body || '';
  return {id:issue.number,title,body,url:issue.html_url,createdAt:issue.created_at,closedAt:issue.closed_at,state:issue.state,maintenance:labels.includes('maintenance')};
}
