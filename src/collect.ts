/**
 * 采集端：Pangolinfo MCP 拉取亚马逊评论 → 生成 pipeline 可用的 reviews.json
 * 用法：
 *   npm run collect -- --keyword "cat water fountain"            # 搜索→自动选 Top 非赞助 ASIN
 *   npm run collect -- --asin B0FPFZ7XFJ --critical 3 --positive 1
 * 默认：--critical 3 --positive 1（4 页 = 40 条，20 积点）
 * 认证：.env 的 PANGOLINFO_API_KEY（JWT）
 */
import { writeFileSync, existsSync, readFileSync } from 'node:fs';

/* ---------------- .env ---------------- */
if (existsSync('.env')) {
    for (const line of readFileSync('.env', 'utf-8').split('\n')) {
        const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
}

const MCP_URL = 'https://mcp.pangolinfo.com/mcp';
const KEY = process.env.PANGOLINFO_API_KEY || '';
if (!KEY) throw new Error('缺少 PANGOLINFO_API_KEY（.env）');

let pointTotal = 0;

/** MCP tools/call 封装（SSE 流式响应解析） */
async function mcpCall<T = any>(name: string, args: Record<string, unknown>): Promise<T> {
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
    const inner = JSON.parse(outer.result.content[0].text);
    if (inner.code !== 0) throw new Error(`${name} bizCode ${inner.code}: ${inner.message}`);
    pointTotal += inner.pointCost || 0;
    console.error(`  [${name}] ok, 耗 ${inner.pointCost ?? 0} 积点`);
    return inner as T;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/* ---------------- 业务流程 ---------------- */

function parseArgs(): { keyword?: string; asin?: string; critical: number; positive: number } {
    const a = process.argv.slice(2);
    const get = (k: string) => (a.includes(`--${k}`) ? a[a.indexOf(`--${k}`) + 1] : undefined);
    return {
        keyword: get('keyword'),
        asin: get('asin'),
        critical: Number(get('critical') ?? 3),
        positive: Number(get('positive') ?? 1),
    };
}

/** 拉一页评论，映射为管线 Review 格式（reviewId 去重） */
type RawReview = { reviewId: string; star: string; purchased?: string | null; title: string; content: string; date: string };
async function fetchReviews(asin: string, star: 'critical' | 'positive', pages: number) {
    const out: any[] = [];
    const seen = new Set<string>();
    for (let p = 1; p <= pages; p++) {
        const r = await mcpCall<{ data: { json: Array<{ data: { results: RawReview[] } }> } }>('get_amazon_reviews', {
            asin, site: 'amz_us', pageCount: p, filterByStar: star, sortBy: 'helpful',
        });
        const list = r.data.json?.[0]?.data?.results ?? [];
        if (list.length === 0) { console.error(`  [reviews/${star}] 第 ${p} 页为空，停止翻页`); break; }
        for (const rv of list) {
            if (!rv.reviewId || seen.has(rv.reviewId)) continue;
            seen.add(rv.reviewId);
            out.push({
                seq: out.length + 1,
                rating: parseFloat(rv.star) || 0,
                verified: /verified/i.test(rv.purchased ?? ''),
                title: rv.title || '',
                body: rv.content || '',
                review_id: rv.reviewId,
                review_date: rv.date,
                sentiment: star === 'critical' ? 'critical' : 'positive',
            });
        }
        if (p < pages) await sleep(1200); // 2 QPS 限制内
    }
    return out;
}

async function main() {
    const opt = parseArgs();
    const t0 = Date.now();
    let asin = opt.asin;

    if (!asin) {
        if (!opt.keyword) throw new Error('需要 --asin 或 --keyword');
        console.error(`==> 搜索 "${opt.keyword}"`);
        const s = await mcpCall<{ data: { json: Array<{ data: { results: Array<{ asin: string; sponsored?: string; rating?: string }> } }> } }>('search_amazon', {
            keyword: opt.keyword, site: 'amz_us',
        });
        const items = s.data.json[0].data.results.filter(i => i.sponsored === '0');
        asin = items[0]?.asin;
        if (!asin) throw new Error('搜索结果为空');
        console.error(`==> 选定 ASIN ${asin}（${items[0].rating ?? ''} 条评论）`);
    }

    console.error(`==> 拉取商品信息（校验评论量）`);
    const prod = await mcpCall<{ data: { json: Array<{ data: { results: Array<Record<string, unknown>> } }> } }>('get_amazon_product', {
        asin, site: 'amz_us',
    });
    const p = prod.data.json[0].data.results[0] || {};
    const reviewCount = parseInt(String(p.rating ?? '0').replace(/[()]/g, '')) || 0;
    console.error(`==> 商品: ${String(p.itemName ?? '').slice(0, 80)} | 评论数 ${reviewCount} | 星级 ${String(p.star ?? '')}`);

    console.error(`==> 拉取差评 ${opt.critical} 页 + 好评 ${opt.positive} 页`);
    await sleep(1000);
    const critical = await fetchReviews(asin, 'critical', opt.critical);
    await sleep(1000);
    const positive = await fetchReviews(asin, 'positive', opt.positive);
    const reviews = [...critical, ...positive].map((r, i) => ({ ...r, seq: i + 1 }));

    const outFile = `sample-data/real-${asin}.json`;
    writeFileSync(outFile, JSON.stringify({
        meta: { asin, title: p.itemName, star: p.star, reviewCount, aiReviewsSummary: p.aiReviewsSummary ?? null, collectedAt: new Date().toISOString() },
        reviews,
    }, null, 2));

    const dist = reviews.reduce((m: Record<string, number>, r: any) => ({ ...m, [r.rating]: (m[r.rating] ?? 0) + 1 }), {});
    console.error(`==> 完成：${reviews.length} 条评论（差评 ${critical.length} / 好评 ${positive.length}），星级分布 ${JSON.stringify(dist)}`);
    console.error(`==> 总积点 ${pointTotal}，耗时 ${((Date.now() - t0) / 1000).toFixed(0)}s，已写入 ${outFile}`);
}

main().catch(e => { console.error(e); process.exit(1); });
