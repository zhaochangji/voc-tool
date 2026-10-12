/**
 * 本地 Web UI：ASIN 输入 → 一键跑完 采集/分析/渲染 → 打开报告
 * 用法：npm run web → http://localhost:8787
 * 原理：编排现有 CLI（collect/analyze/render），不做重构；单用户串行队列
 */
import http from 'node:http';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const execP = promisify(exec);
const PORT = Number(process.env.WEB_PORT || 8787);
const CWD = process.cwd();

let running = false;

function page(_body?: string) {
    return `<!DOCTYPE html><html lang="zh"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>VOC 报告生成器</title>
<style>
  :root { --ink:#1f2937; --sub:#6b7280; --line:#e5e7eb; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:-apple-system,"PingFang SC","Segoe UI",sans-serif; color:var(--ink); background:#f9fafb; line-height:1.6; }
  .wrap { max-width:640px; margin:60px auto; padding:0 20px; }
  .card { background:#fff; border:1px solid var(--line); border-radius:16px; padding:28px; }
  h1 { font-size:20px; margin-bottom:4px; }
  .sub { color:var(--sub); font-size:13px; margin-bottom:22px; }
  label { display:block; font-size:13px; font-weight:600; margin:14px 0 6px; }
  input, select { width:100%; padding:10px 12px; border:1px solid var(--line); border-radius:10px; font-size:15px; }
  button { width:100%; margin-top:20px; padding:12px; border:0; border-radius:10px; background:#4f46e5; color:#fff; font-size:15px; font-weight:700; cursor:pointer; }
  button:disabled { background:#a5b4fc; cursor:not-allowed; }
  .log { margin-top:18px; background:#111827; color:#d1d5db; border-radius:10px; padding:14px; font-family:Menlo,monospace; font-size:12px; white-space:pre-wrap; max-height:260px; overflow-y:auto; display:none; }
  .link { margin-top:16px; text-align:center; display:none; }
  .link a { color:#4f46e5; font-weight:700; font-size:16px; }
  .err { color:#dc2626; font-size:13px; margin-top:10px; display:none; }
  .tip { margin-top:16px; color:var(--sub); font-size:12px; }
</style></head><body><div class="wrap"><div class="card">
  <h1>VOC 报告生成器</h1>
  <div class="sub">输入 ASIN → 自动采集 40-50 条评论 → 生成双语网页报告（约 1 分钟，免费额度内）</div>
  <form id="f">
    <label>ASIN（Amazon 商品页 /dp/ 后面那串）</label>
    <input id="asin" placeholder="例如 B07P4HBRMV" required maxlength="10" pattern="[A-Za-z0-9]{10}">
    <label>差评页组（每组 10 条 1-2 星 + 5 条 3 星）</label>
    <select id="critical"><option value="3" selected>3 组（默认）</option><option value="2">2 组</option><option value="1">1 组（最省）</option></select>
    <label>好评组（每组 10 条 4-5 星）</label>
    <select id="positive"><option value="1" selected>1 组（默认）</option><option value="0">0 组</option></select>
    <button id="btn" type="submit">生成报告</button>
    <div class="log" id="log"></div>
    <div class="err" id="err"></div>
    <div class="link" id="link"><a href="/report.html" target="_blank">📄 打开最新报告（新标签页）</a></div>
    <div class="tip">提示：评论数 500+ 的 ASIN 效果最好；差评太少的产品报告会偏薄。</div>
  </form>
</div></div>
<script>
const f = document.getElementById('f'), btn = document.getElementById('btn'),
      log = document.getElementById('log'), err = document.getElementById('err'), link = document.getElementById('link');
f.addEventListener('submit', async e => {
  e.preventDefault();
  btn.disabled = true; err.style.display = 'none'; link.style.display = 'none';
  log.style.display = 'block'; log.textContent = '排队中…';
  try {
    const res = await fetch('/run', { method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ asin: document.getElementById('asin').value.trim().toUpperCase(),
                             critical: +document.getElementById('critical').value,
                             positive: +document.getElementById('positive').value }) });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || res.statusText);
    log.textContent += d.log;
    log.textContent += '\\n✅ 全部完成';
    link.style.display = 'block';
    window.open('/report.html?v=' + Date.now(), '_blank');
  } catch (e) {
    err.textContent = '❌ ' + e.message; err.style.display = 'block';
  } finally { btn.disabled = false; }
});
</script></body></html>`;
}

async function runPipeline(asin: string, critical: number, positive: number): Promise<string> {
    const run = async (cmd: string) => {
        const { stdout, stderr } = await execP(cmd, { cwd: CWD, timeout: 420_000, maxBuffer: 10 * 1024 * 1024 });
        return (stdout + stderr).trim();
    };
    const src = `sample-data/real-${asin}.json`;
    let log = '';
    log += `\n[1/3] 采集评论…\n` + await run(`npx tsx src/collect.ts --provider apify --asin ${asin} --critical ${critical} --positive ${positive}`);
    if (!existsSync(path.join(CWD, src))) throw new Error(`采集未产出 ${src}（评论可能太少或 ASIN 无效）`);
    log += `\n[2/3] LLM 双语分析…\n` + await run(`npx tsx src/pipeline.ts ${src}`);
    log += `\n[3/3] 渲染网页报告…\n` + await run(`npx tsx src/render.ts ${src}`);
    return log;
}

const server = http.createServer(async (req, res) => {
    const url = (req.url || '/').split('?')[0];
    if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(page());
        return;
    }
    if (req.method === 'GET' && url === '/report.html' && existsSync(path.join(CWD, 'report.html'))) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(readFileSync(path.join(CWD, 'report.html')));
        return;
    }
    if (req.method === 'POST' && url === '/run') {
        if (running) { res.writeHead(409, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: '有任务正在运行，请等它完成' })); return; }
        let body = '';
        req.on('data', c => body += c);
        req.on('end', async () => {
            try {
                const { asin, critical = 3, positive = 1 } = JSON.parse(body || '{}');
                if (!/^[A-Z0-9]{10}$/i.test(asin || '')) throw new Error('ASIN 格式不对（应为 10 位字母数字）');
                running = true;
                const log = await runPipeline(asin.toUpperCase(), +critical, +positive);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true, log }));
            } catch (e: any) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message || String(e) }));
            } finally { running = false; }
        });
        return;
    }
    res.writeHead(404); res.end('not found');
});

server.listen(PORT, () => {
    console.error(`==> VOC Web UI 已启动: http://localhost:${PORT}`);
    if (!existsSync(path.join(CWD, '.env'))) console.error('⚠️ 未找到 .env（APIFY_TOKEN / OPENAI_API_KEY）');
});
