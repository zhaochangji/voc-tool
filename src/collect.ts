/**
 * 采集端（双供应商）→ 生成 pipeline 可用的 reviews.json
 * 用法：
 *   npm run collect -- --provider apify --asin B00CPDWT2M               # Apify（免费 $5/月额度，测试期主用）
 *   npm run collect -- --provider pangolin --keyword "cat water fountain" # Pangolinfo（$19/月，效果对比用）
 *   npm run collect -- --asin B0XXXX --critical 3 --positive 1            # 供应商取 .env 的 PROVIDER，默认 apify
 * 默认：--critical 3 --positive 1
 * 认证（.env）：APIFY_TOKEN / PANGOLINFO_API_KEY
 * 供应商对比记录见 PROVIDERS.md
 */
import { writeFileSync, existsSync, readFileSync } from 'node:fs';

/* ---------------- .env ---------------- */
if (existsSync('.env')) {
    for (const line of readFileSync('.env', 'utf-8').split('\n')) {
        const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
}

/* ---------------- 通用评论结构（两种供应商都映射到这里） ---------------- */

type CollectedReview = {
    rating: number;
    verified: boolean;
    title: string;
    body: string;
    review_id: string;
    review_date: string;
    sentiment: 'critical' | 'positive';
    helpful?: number;
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function parseArgs() {
    const a = process.argv.slice(2);
    const get = (k: string) => (a.includes(`--${k}`) ? a[a.indexOf(`--${k}`) + 1] : undefined);
    return {
        provider: get('provider') ?? process.env.PROVIDER ?? 'apify',
        keyword: get('keyword'),
        asin: get('asin'),
        critical: Number(get('critical') ?? 3),
        positive: Number(get('positive') ?? 1),
    };
}

function writeOut(asin: string, meta: Record<string, unknown>, collected: CollectedReview[], suffix = '') {
    const reviews = collected.map((r, i) => ({ ...r, seq: i + 1 }));
    const outFile = `sample-data/real-${asin}${suffix}.json`;
    writeFileSync(outFile, JSON.stringify({
        meta: { ...meta, asin, collectedAt: new Date().toISOString(), partial: suffix === '.partial' },
        reviews,
    }, null, 2));
    return outFile;
}

/* ================= 供应商 1：Pangolinfo（MCP） ================= */

const MCP_URL = 'https://mcp.pangolinfo.com/mcp';
let pointTotal = 0;

async function mcpCall<T = any>(name: string, args: Record<string, unknown>): Promise<T> {
    const KEY = process.env.PANGOLINFO_API_KEY || '';
    if (!KEY) throw new Error('缺少 PANGOLINFO_API_KEY（.env）');
    for (let attempt = 0; attempt <= 1; attempt++) {
        const res = await fetch(MCP_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${KEY}`,
                'Content-Type': 'application/json',
                Accept: 'application/json, text/event-stream',
            },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
        });
        if (!res.ok) throw new Error(`${name} HTTP ${res.status}`);
        const text = await res.text();
        const dataLine = text.split('\n').find(l => l.startsWith('data:'));
        if (!dataLine) throw new Error(`${name} 无 SSE data 响应`);
        const outer = JSON.parse(dataLine.slice(5));
        if (outer.error) throw new Error(`${name} MCP error: ${JSON.stringify(outer.error)}`);
        const rawText: string = outer.result?.content?.[0]?.text ?? '';
        if (outer.result?.isError || !rawText.trimStart().startsWith('{')) {
            if (attempt === 0 && /\[RATE_LIMIT\]/.test(rawText)) {
                console.error(`  [${name}] RATE_LIMIT，等 3s 重试一次`);
                await sleep(3000);
                continue;
            }
            throw new Error(`${name} 服务端错误：${rawText.slice(0, 200)}`);
        }
        const inner = JSON.parse(rawText);
        if (inner.code !== 0) throw new Error(`${name} bizCode ${inner.code}: ${inner.message}`);
        pointTotal += inner.pointCost || 0;
        console.error(`  [${name}] ok, 耗 ${inner.pointCost ?? 0} 积点`);
        return inner as T;
    }
    throw new Error(`${name} 重试后仍失败`);
}

async function pangolinCollect(asin: string, critical: number, positive: number, collected: CollectedReview[]) {
    const push = (list: any[], star: 'critical' | 'positive') => {
        const seen = new Set<string>();
        for (const rv of list) {
            if (!rv.reviewId || seen.has(rv.reviewId)) continue;
            seen.add(rv.reviewId);
            collected.push({
                rating: parseFloat(rv.star) || 0,
                verified: /verified/i.test(rv.purchased ?? ''),
                title: rv.title || '',
                body: rv.content || '',
                review_id: rv.reviewId,
                review_date: rv.date,
                sentiment: star === 'critical' ? 'critical' : 'positive',
            });
        }
    };
    for (let p = 1; p <= critical; p++) {
        const r = await mcpCall<{ data: { json: Array<{ data: { results: any[] } }> } }>('get_amazon_reviews', {
            asin, site: 'amz_us', pageCount: p, filterByStar: 'critical', sortBy: 'helpful',
        });
        const list = r.data.json?.[0]?.data?.results ?? [];
        if (!list.length) { console.error(`  [pangolin critical] 第 ${p} 页为空`); break; }
        push(list, 'critical');
        if (p < critical) await sleep(1200);
    }
    await sleep(1000);
    for (let p = 1; p <= positive; p++) {
        const r = await mcpCall<{ data: { json: Array<{ data: { results: any[] } }> } }>('get_amazon_reviews', {
            asin, site: 'amz_us', pageCount: p, filterByStar: 'positive', sortBy: 'helpful',
        });
        const list = r.data.json?.[0]?.data?.results ?? [];
        if (!list.length) { console.error(`  [pangolin positive] 第 ${p} 页为空`); break; }
        push(list, 'positive');
        if (p < positive) await sleep(1200);
    }
    return { providerMeta: { provider: 'pangolin', pointCost: pointTotal } };
}

/* ================= 供应商 2：Apify（免费额度，测试期主用） ================= */

const APIFY_ACTOR = process.env.APIFY_ACTOR || 'jdtpnjtp~amazon-reviews'; // 实测可用；web_wanderer 在免费账号拿不到数据

async function apifyCollect(asin: string, critical: number, positive: number, collected: CollectedReview[]) {
    const TOKEN = process.env.APIFY_TOKEN || '';
    if (!TOKEN) throw new Error('缺少 APIFY_TOKEN（.env）——注册 apify.com 后在 Settings → API & Integrations 复制');

    // 目标条数：差评/好评需要量 * 富余（actor 不保证正好，我们本地再按星级分流）
    const want = (critical + positive) * 10 + 40;
    const input: Record<string, unknown> = process.env.APIFY_INPUT_JSON
        ? JSON.parse(process.env.APIFY_INPUT_JSON)
        : {
              // ⚠️ 输入字段为初版猜测，拿到 Token 后用 GET /v2/acts/{id}/input 校准
              productUrls: [`https://www.amazon.com/dp/${asin}`],
              maxReviews: want,
          };

    console.error(`  [apify] 运行采集器 ${APIFY_ACTOR}（约 1-3 分钟，按量计费约 $${(want * 0.0018).toFixed(2)}）`);
    const res = await fetch(
        `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?token=${TOKEN}&timeout=300`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) },
    );
    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`apify HTTP ${res.status}: ${errText.slice(0, 300)}`);
    }
    const items: any[] = await res.json();
    console.error(`  [apify] 拉到 ${items.length} 条原始评论，本地按星级分流`);

    // Apify 返回全量评论 → 本地分差评(≤3星)/好评(≥4星)，各取所需数量
    const seen = new Set<string>();
    let nCritical = 0, nPositive = 0;
    for (const it of items) {
        const id = it.reviewId || it.id;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const rating = Number(it.rating) || 0;
        const isCrit = rating <= 3;
        if (isCrit && nCritical >= critical * 10) continue;
        if (!isCrit && nPositive >= positive * 10) continue;
        if (isCrit) nCritical++; else nPositive++;
        collected.push({
            rating,
            verified: it.verifiedPurchase === true,
            title: it.reviewTitle || '',
            body: it.reviewText || '',
            review_id: id,
            review_date: it.reviewDate || '',
            sentiment: isCrit ? 'critical' : 'positive',
            helpful: it.helpfulVoteCount ?? undefined,
        });
    }
    return { provider: 'apify', items: items.length };
}

/* ================= 主流程 ================= */

async function main() {
    const opt = parseArgs();
    const t0 = Date.now();
    let asin = opt.asin;
    let providerMeta: Record<string, unknown> = {};

    // ASIN 优先；关键词搜索目前仅 pangolin 支持（Apify 搜索采集器需另外接入，内测期手动给 ASIN 即可）
    if (!asin && opt.keyword) {
        if (opt.provider !== 'pangolin') {
            console.error('==> 关键词搜索目前仅 pangolin 供应商支持；请直接给 --asin（从 Amazon 页面复制）');
            console.error('==> 临时切到 pangolin 执行搜索……');
        }
        console.error(`==> 搜索 "${opt.keyword}"`);
        const s = await mcpCall<{ data: { json: Array<{ data: { results: Array<{ asin: string; sponsored?: string; rating?: string }> } }> } }>('search_amazon', {
            keyword: opt.keyword, site: 'amz_us',
        });
        const items = s.data.json[0].data.results.filter(i => i.sponsored === '0');
        asin = items[0]?.asin;
        if (!asin) throw new Error('搜索结果为空');
        console.error(`==> 选定 ASIN ${asin}（${items[0].rating ?? ''} 条评论）`);
    }
    if (!asin) throw new Error('需要 --asin 或 --keyword');

    const collected: CollectedReview[] = [];
    const meta: Record<string, unknown> = {};

    try {
        console.error(`==> 供应商 ${opt.provider}，拉取差评 ${opt.critical} 页组 + 好评 ${opt.positive} 页组`);
        if (opt.provider === 'pangolin') {
            providerMeta = await pangolinCollect(asin, opt.critical, opt.positive, collected);
        } else {
            providerMeta = await apifyCollect(asin, opt.critical, opt.positive, collected);
        }
        Object.assign(meta, providerMeta);

        const outFile = writeOut(asin, meta, collected);
        const dist = collected.reduce((m: Record<string, number>, r) => ({ ...m, [r.rating]: (m[r.rating] ?? 0) + 1 }), {});
        const crit = collected.filter(r => r.sentiment === 'critical').length;
        const pos = collected.filter(r => r.sentiment === 'positive').length;
        console.error(`==> 完成：${collected.length} 条（差评 ${crit} / 好评 ${pos}），星级分布 ${JSON.stringify(dist)}`);
        console.error(`==> 耗时 ${((Date.now() - t0) / 1000).toFixed(0)}s，已写入 ${outFile}`);
        console.error(`==> 下一步: npm run analyze -- ${outFile}`);
    } catch (e: any) {
        if (collected.length > 0) {
            const f = writeOut(asin, meta, collected, '.partial');
            console.error(`==> ⚠️ 中断，已保存部分数据（${collected.length} 条）到 ${f}，可直接 analyze`);
        }
        throw e;
    }
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
