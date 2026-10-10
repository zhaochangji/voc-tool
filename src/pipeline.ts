/**
 * VOC 分析管线（MVP）
 * 用法：
 *   OPENAI_API_KEY=sk-xxx npm run analyze -- sample-data/example.json
 *
 * 三段式：Stage1 批量打标 → Stage2 聚类归并 → Stage3 报告合成
 * 内置：JSON Schema 校验、失败重试 1 次、token/成本统计
 */
import OpenAI from 'openai';
import { z } from 'zod';
import { readFileSync, writeFileSync } from 'node:fs';

/* ---------------- 类型与 Schema ---------------- */

const ReviewSchema = z.object({
    seq: z.number().int(),
    rating: z.number().min(1).max(5),
    verified: z.boolean().default(false),
    title: z.string().default(''),
    body: z.string(),
});

// Stage1 输出：单条打标
const TagSchema = z.object({
    seq: z.number().int(),
    rating_bin: z.enum(['praise', 'complaint', 'scenario', 'persona', 'suspect']),
    topic: z.string(),
    severity: z.number().min(1).max(5).nullable().default(null),
    supports_listing_fix: z.boolean().nullable().default(null),
});

// Stage2 输出：缺陷/优点主题
const ThemeSchema = z.object({
    theme: z.string(),
    frequency: z.number().int(),
    severity_avg: z.number().min(0).max(5),
    sample_seqs: z.array(z.number().int()).length(3), // ★ 强制引用原文，防幻觉
    root_cause: z.enum([
        'quality', 'size_mismatch', 'listing_misleading', 'packaging', 'logistics', 'expectation_gap',
    ]),
    listing_action: z.string(),
});

// Stage3 输出：最终报告
const ReportSchema = z.object({
    executive_summary: z.string(),
    top_strengths: z.array(z.object({ theme: z.string(), frequency: z.number() })),
    top_risks: z.array(z.object({ theme: z.string(), frequency: z.number() })),
    buyer_personas: z.array(z.string()),
    listing_rewrite_checklist: z.array(z.string()),
    verdict: z.enum(['buy-to-sell', 'improve-first', 'avoid']),
});

type Review = z.infer<typeof ReviewSchema>;
type Tag = z.infer<typeof TagSchema>;
type Theme = z.infer<typeof ThemeSchema>;
type Report = z.infer<typeof ReportSchema>;

/* ---------------- 成本表（按需换成你的模型价格，单位 USD / 1M tokens） ---------------- */
const MODEL = process.env.VOC_MODEL || 'gpt-4o-mini';
const PRICE = { input: 0.15, output: 0.6 };

/* ---------------- LLM 调用封装：JSON 校验 + 重试 + 成本统计 ---------------- */

const client = new OpenAI();
let totalTokens = { input: 0, output: 0 };

async function callJSON<T>(schema: z.ZodType<T>, prompt: string, tag: string): Promise<T> {
    for (let attempt = 0; attempt <= 1; attempt++) {
        const res = await client.chat.completions.create({
            model: MODEL,
            temperature: 0,
            response_format: { type: 'json_object' },
            messages: [{ role: 'user', content: prompt }],
        });
        const usage = res.usage!;
        totalTokens.input += usage.prompt_tokens;
        totalTokens.output += usage.completion_tokens;
        try {
            const parsed = schema.parse(JSON.parse(res.choices[0].message.content!));
            console.error(`  [${tag}] ok  (in:${usage.prompt_tokens} out:${usage.completion_tokens})`);
            return parsed;
        } catch (e) {
            if (attempt === 1) throw new Error(`[${tag}] 输出两次未通过 Schema 校验: ${String(e)}`);
            console.error(`  [${tag}] Schema 校验失败，重试一次`);
        }
    }
    throw new Error('unreachable');
}

/* ---------------- Prompts ---------------- */

function stage1Prompt(batch: Review[]): string {
    return `你是亚马逊评论分析引擎。对以下评论逐条输出 JSON（对象格式 {"tags": [...]}），每条包含：
rating_bin: "praise" | "complaint" | "scenario" | "persona" | "suspect"(疑似刷单)
topic: 一句话主题(英文, <=12词)
severity: 1-5（仅 complaint 填数字，其余 null）
supports_listing_fix: true/false/null（抱怨能否靠改 Listing 文案缓解，如"尺寸说明不清"=true，"两周就坏"=false；非 complaint 为 null）

规则：只依据原文，不得推断；tags 顺序与输入 seq 一致；仅输出 JSON。
评论（seq, rating, verified, title, body）：
${batch.map(r => `#${r.seq} | ${r.rating}星 | VP:${r.verified} | ${r.title}\n${r.body}`).join('\n---\n')}`;
}

function stage2Prompt(tags: Tag[], reviewsById: Map<number, Review>): string {
    const complaints = tags.filter(t => t.rating_bin === 'complaint');
    const praises = tags.filter(t => t.rating_bin === 'praise');
    const digest = (list: Tag[]) =>
        list.map(t => {
            const r = reviewsById.get(t.seq);
            return `seq=${t.seq} sev=${t.severity} topic="${t.topic}" fixable=${t.supports_listing_fix} 原文摘要:${r?.body.slice(0, 80)}`;
        }).join('\n');
    return `以下是同一产品的评论打标结果。聚成 3-8 个主题，输出 JSON（{"themes": [...]}），每个主题：
theme: 主题名(名词短语)
frequency: 提及次数（统计打标结果，不是猜）
severity_avg: 平均严重度(0-5)
sample_seqs: 3 个最典型评论的 seq（必须从下列真实 seq 中取，禁止编造）
root_cause: quality|size_mismatch|listing_misleading|packaging|logistics|expectation_gap
listing_action: 一句可执行的修改建议（无法缓解则输出 "not_fixable_by_listing"）
主题按 frequency*severity_avg 排序。仅输出 JSON。

【抱怨打标】
${digest(complaints)}

【好评打标】
${digest(praises)}`;
}

function stage3Prompt(themes: Theme[], reviewCount: number): string {
    return `基于以下主题数据（来自 ${reviewCount} 条评论）写报告，目标读者为亚马逊中小卖家。输出 JSON：
executive_summary: 3 句话——最大风险与机会
top_strengths / top_risks: 各最多 3 条 {theme, frequency}
buyer_personas: 2-3 个买家画像(一句话/个)
listing_rewrite_checklist: 按风险排序的可执行清单
verdict: "buy-to-sell" | "improve-first" | "avoid"
仅输出 JSON。

${JSON.stringify(themes, null, 2)}`;
}

/* ---------------- 管线 ---------------- */

async function runStage1(reviews: Review[]): Promise<Tag[]> {
    const BATCH = 20;
    const tags: Tag[] = [];
    for (let i = 0; i < reviews.length; i += BATCH) {
        const batch = reviews.slice(i, i + BATCH);
        // zod 数组嵌套在 json_object 下：让模型包 {"tags": [...]} 再取出
        const out = await callJSON(
            z.object({ tags: z.array(TagSchema).length(batch.length) }),
            stage1Prompt(batch),
            `stage1/${i / BATCH + 1}`,
        );
        tags.push(...out.tags);
    }
    return tags;
}

async function main() {
    const inputPath = process.argv[2];
    if (!inputPath) throw new Error('用法: npm run analyze -- <reviews.json>');
    const loaded = JSON.parse(readFileSync(inputPath, 'utf-8'));
    // 兼容 collect.ts 产物（{meta, reviews}）与裸数组两种格式
    const reviews = z.array(ReviewSchema).parse(Array.isArray(loaded) ? loaded : loaded.reviews);
    const reviewsById = new Map(reviews.map(r => [r.seq, r]));

    console.error(`==> 共 ${reviews.length} 条评论，模型 ${MODEL}`);
    const t0 = Date.now();

    const tags = await runStage1(reviews);
    const themesOut = await callJSON(
        z.object({ themes: z.array(ThemeSchema).min(1).max(8) }),
        stage2Prompt(tags, reviewsById),
        'stage2',
    );
    const report: Report = await callJSON(ReportSchema, stage3Prompt(themesOut.themes, reviews.length), 'stage3');

    const cost =
        (totalTokens.input / 1e6) * PRICE.input + (totalTokens.output / 1e6) * PRICE.output;
    const out = { meta: { model: MODEL, reviewCount: reviews.length, cost_usd: +cost.toFixed(4), tokens: totalTokens }, report, themes: themesOut.themes };
    writeFileSync('report.json', JSON.stringify(out, null, 2));
    console.error(`==> 完成 ${((Date.now() - t0) / 1000).toFixed(1)}s，成本约 $${cost.toFixed(4)}，已写入 report.json`);
    console.log(JSON.stringify(out.report, null, 2));
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
