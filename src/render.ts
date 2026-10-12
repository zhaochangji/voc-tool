/**
 * 报告生成器：report.json + 源评论数据 → report.html（单文件网页，双击即看）
 * 用法：
 *   npm run render -- sample-data/real-B00CPDWT2M.json
 *   # 默认读当前目录 report.json（analyze 的产物），源数据文件传参进来
 *   # 产物: report.html → 浏览器打开
 */
import { readFileSync, writeFileSync } from 'node:fs';

const srcPath = process.argv[2];
if (!srcPath) throw new Error('用法: npm run render -- sample-data/real-XXXX.json');

type Report = {
    meta: { model: string; reviewCount: number; cost_usd: number };
    report: {
        executive_summary: string;
        top_strengths: { theme: string; frequency: number }[];
        top_risks: { theme: string; frequency: number }[];
        buyer_personas: string[];
        listing_rewrite_checklist: string[];
        verdict: string;
    };
    themes: {
        kind: 'strength' | 'risk';
        theme: string;
        frequency: number;
        severity_avg: number;
        sample_seqs: number[];
        root_cause: string;
        listing_action: string;
    }[];
};
type Review = { seq: number; rating: number; verified: boolean; title: string; body: string; review_date: string; sentiment: string; helpful?: number };

const report: Report = JSON.parse(readFileSync('report.json', 'utf-8'));
const srcRaw = JSON.parse(readFileSync(srcPath, 'utf-8'));
const reviews: Review[] = srcRaw.reviews ?? srcRaw;
const prodMeta = srcRaw.meta ?? {};
const reviewById = new Map(reviews.map(r => [r.seq, r]));

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const ROOT_CAUSE: Record<string, string> = {
    quality: '质量问题', size_mismatch: '尺寸不符', listing_misleading: '文案误导',
    packaging: '包装问题', logistics: '物流问题', expectation_gap: '期望落差',
};
const VERDICT: Record<string, { label: string; cls: string; note: string }> = {
    'buy-to-sell': { label: '✅ 值得入场', cls: 'ok', note: '评论结构健康，可作为选品参考' },
    'improve-first': { label: '⚠️ 先改后卖', cls: 'warn', note: '存在可改进的结构性缺陷，入场前先解决' },
    avoid: { label: '⛔ 建议放弃', cls: 'bad', note: '差评风险过高，不建议入场' },
};
const v = VERDICT[report.report.verdict] ?? VERDICT['improve-first'];

const cited = report.themes.flatMap(t => t.sample_seqs);
const citationOk = cited.filter(s => reviewById.has(s)).length;

const themeCard = (t: Report['themes'][number]) => {
    const quotes = t.sample_seqs
        .map(s => reviewById.get(s))
        .filter(Boolean)
        .map(r => `
      <blockquote class="quote">
        <div class="quote-head"><span class="stars star${r!.rating}">${'★'.repeat(r!.rating)}${'☆'.repeat(5 - r!.rating)}</span> <span class="qtitle">${esc(r!.title)}</span> <span class="qmeta">${r!.verified ? '✓ 已验证购买' : '未验证'} · ${esc(r!.review_date)}${r!.helpful ? ` · ${r!.helpful} 人觉得有用` : ''}</span></div>
        <div class="qbody">${esc(r!.body.slice(0, 400))}${r!.body.length > 400 ? '…' : ''}</div>
      </blockquote>`)
        .join('');
    return `
    <div class="card theme ${t.kind}">
      <div class="theme-head">
        <span class="badge ${t.kind}">${t.kind === 'risk' ? '⚠️ 风险' : '👍 优点'}</span>
        <h3>${esc(t.theme)}</h3>
        <span class="freq">出现 ${t.frequency} 次</span>
        ${t.kind === 'risk' ? `<span class="sev">严重度 ${t.severity_avg.toFixed(1)}/5</span>` : ''}
      </div>
      <div class="meta-row">
        <span class="tag">归因：${ROOT_CAUSE[t.root_cause] ?? t.root_cause}</span>
        <span class="tag action">建议：${esc(t.listing_action)}</span>
      </div>
      ${quotes ? `<details open><summary>引用的原评论 (${t.sample_seqs.length})</summary>${quotes}</details>` : ''}
    </div>`;
};

const html = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>VOC 报告 · ${esc(prodMeta.title ?? prodMeta.asin ?? 'Amazon 产品')}</title>
<style>
  :root { --red:#dc2626; --redbg:#fef2f2; --green:#16a34a; --greenbg:#f0fdf4; --ink:#1f2937; --sub:#6b7280; --line:#e5e7eb; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, "PingFang SC", "Segoe UI", sans-serif; color: var(--ink); background: #f9fafb; line-height: 1.65; }
  .wrap { max-width: 860px; margin: 0 auto; padding: 32px 20px 60px; }
  header.hero { background: linear-gradient(135deg,#111827,#1f2937); color: #fff; border-radius: 16px; padding: 28px 30px; margin-bottom: 20px; }
  .hero h1 { font-size: 21px; font-weight: 700; margin-bottom: 6px; }
  .hero .sub { color: #d1d5db; font-size: 13px; }
  .hero .verdict { display: inline-block; margin-top: 14px; padding: 6px 14px; border-radius: 999px; font-weight: 700; font-size: 15px; }
  .verdict.ok { background: #16a34a; } .verdict.warn { background: #f59e0b; } .verdict.bad { background: #dc2626; }
  .verdict-note { color: #9ca3af; font-size: 12px; margin-left: 8px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 16px 0; }
  @media (max-width: 700px) { .grid2 { grid-template-columns: 1fr; } }
  .card { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 18px 20px; }
  .sec-title { font-size: 15px; font-weight: 700; margin: 26px 0 12px; display: flex; align-items: center; gap: 8px; }
  .sec-title .dot { width: 8px; height: 8px; border-radius: 50%; }
  .summary { background: #fff; border-left: 4px solid #4f46e5; border-radius: 8px; padding: 16px 18px; font-size: 14px; }
  .pill-list { display: flex; flex-wrap: wrap; gap: 8px; }
  .pill { padding: 8px 14px; border-radius: 10px; font-size: 13px; font-weight: 600; }
  .pill.risk { background: var(--redbg); color: var(--red); } .pill.strength { background: var(--greenbg); color: var(--green); }
  .pill .n { opacity: .65; font-weight: 400; margin-left: 4px; }
  .card.theme.risk { border-top: 3px solid var(--red); } .card.theme.strength { border-top: 3px solid var(--green); }
  .theme-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .theme-head h3 { font-size: 16px; flex: 1; min-width: 200px; }
  .badge { font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 999px; }
  .badge.risk { background: var(--redbg); color: var(--red); } .badge.strength { background: var(--greenbg); color: var(--green); }
  .freq { font-size: 12px; color: var(--sub); background: #f3f4f6; padding: 3px 10px; border-radius: 999px; }
  .sev { font-size: 12px; color: #fff; background: var(--red); padding: 3px 10px; border-radius: 999px; }
  .meta-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  .tag { font-size: 12px; background: #f3f4f6; color: #374151; padding: 4px 10px; border-radius: 8px; }
  .tag.action { background: #eef2ff; color: #4338ca; flex: 1; min-width: 240px; }
  details { margin-top: 12px; }
  summary { cursor: pointer; font-size: 13px; color: #4f46e5; font-weight: 600; }
  .quote { border: 1px dashed var(--line); border-radius: 10px; padding: 10px 14px; margin-top: 8px; background: #fafafa; }
  .quote-head { font-size: 12px; color: var(--sub); display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .qtitle { font-weight: 600; color: var(--ink); }
  .stars { color: #f59e0b; letter-spacing: 1px; }
  .qbody { font-size: 13px; margin-top: 4px; color: #374151; white-space: pre-wrap; }
  ol.checklist { counter-reset: c; list-style: none; }
  ol.checklist li { counter-increment: c; background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 12px 16px 12px 46px; margin-bottom: 8px; position: relative; font-size: 14px; }
  ol.checklist li::before { content: counter(c); position: absolute; left: 14px; top: 12px; width: 22px; height: 22px; background: #4f46e5; color: #fff; border-radius: 50%; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
  footer { margin-top: 30px; color: var(--sub); font-size: 12px; text-align: center; }
  .personas { display: flex; flex-wrap: wrap; gap: 8px; }
  .persona { background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px; font-size: 13px; }
</style>
</head>
<body>
<div class="wrap">
  <header class="hero">
    <h1>${esc(prodMeta.title ?? 'Amazon 产品')} ${prodMeta.star ? `<span style="font-size:14px;color:#fbbf24">★ ${esc(prodMeta.star)}</span>` : ''}</h1>
    <div class="sub">ASIN ${esc(prodMeta.asin)} · ${prodMeta.reviewCount ?? report.meta.reviewCount} 条评论 · 分析 ${reviews.length} 条（差评 ${reviews.filter(r => r.sentiment === 'critical').length} / 好评 ${reviews.filter(r => r.sentiment === 'positive').length}）· ${new Date().toLocaleString('zh-CN')}</div>
    <div><span class="verdict ${v.cls}">${v.label}</span><span class="verdict-note">${v.note}</span></div>
  </header>

  <div class="summary">${esc(report.report.executive_summary)}</div>

  <div class="grid2">
    <div class="card">
      <div class="sec-title" style="margin:0 0 10px"><span class="dot" style="background:var(--red)"></span>主要风险</div>
      <div class="pill-list">${report.report.top_risks.map(r => `<span class="pill risk">${esc(r.theme)}<span class="n">×${r.frequency}</span></span>`).join('')}</div>
    </div>
    <div class="card">
      <div class="sec-title" style="margin:0 0 10px"><span class="dot" style="background:var(--green)"></span>主要优点</div>
      <div class="pill-list">${report.report.top_strengths.map(r => `<span class="pill strength">${esc(r.theme)}<span class="n">×${r.frequency}</span></span>`).join('')}</div>
    </div>
  </div>

  <div class="sec-title"><span class="dot" style="background:#4f46e5"></span>主题明细（每个结论都引用了原评论）</div>
  ${report.themes.map(themeCard).join('')}

  <div class="sec-title"><span class="dot" style="background:#0891b2"></span>买家画像</div>
  <div class="personas">${report.report.buyer_personas.map(p => `<span class="persona">👤 ${esc(p)}</span>`).join('')}</div>

  <div class="sec-title"><span class="dot" style="background:#4f46e5"></span>Listing 改写清单（按优先级）</div>
  <ol class="checklist">${report.report.listing_rewrite_checklist.map(c => `<li>${esc(c)}</li>`).join('')}</ol>

  <footer>
    引用可信度：${citationOk}/${cited.length} 条引用指向真实评论 · 分析模型 ${esc(report.meta.model)} · LLM 成本 $${report.meta.cost_usd} · 生成于 voc-tool
  </footer>
</div>
</body>
</html>`;

writeFileSync('report.html', html);
console.error(`==> 已生成 report.html（${(html.length / 1024).toFixed(0)} KB），双击或 open report.html 查看`);
console.error(`==> 引用可信度 ${citationOk}/${cited.length}`);
