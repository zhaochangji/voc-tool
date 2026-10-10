/**
 * VOC 分析管线（MVP）
 * 用法：
 *   OPENAI_API_KEY=sk-xxx npm run analyze -- sample-data/example.json   # 真实模式
 *   VOC_DRY_RUN=1 npm run analyze -- sample-data/example.json           # 桩模式（无 Key 验证链路）
 *
 * 三段式：Stage1 批量打标 → Stage2 聚类归并 → Stage3 报告合成
 * 内置：JSON Schema 校验、失败重试 1 次、token/成本统计、DRY_RUN 桩模式
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

/* ---------------- 运行配置 ---------------- */

const MODEL = process.env.VOC_MODEL || 'gpt-4o-mini';
// 成本表：USD / 1M tokens（换模型时同步更新）
const PRICE = { input: 0.15, output: 0.6 };
const DRY_RUN = process.env.VOC_DRY_RUN === '1';

// 懒加载：DRY_RUN 模式下无 API Key 也能运行
let client: OpenAI | null = null;
const getClient = () => (client ??= new OpenAI());
let totalTokens = { input: 0, output: 0 };

/* ---------------- LLM 调用封装：JSON 校验 + 重试 + 成本统计 ---------------- */

async function callJSON<T>(schema: { parse: (data: unknown) => T }, prompt: string, tag: string): Promise<T> {
    for (let attempt = 0; attempt <= 1; attempt++) {
        const res = await getClient().chat.completions.create({
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

/* ---------------- DRY_RUN 桩（确定性规则，仅验证编排链路，非真实分析） ---------------- */

const stubTags = (batch: Review[]): Tag[] =>
    batch.map(r =>
        !r.verified
            ? { seq: r.seq, rating_bin: 'suspect', topic: 'unverified generic praise', severity: null, supports_listing_fix: null }
            : r.rating >= 4
            ? { seq: r.seq, rating_bin: 'praise', topic: 'works as expected', severity: null, supports_listing_fix: null }
            : r.rating <= 2
            ? { seq: r.seq, rating_bin: 'complaint', topic: 'product failed or misleading', severity: 4, supports_listing_fix: r.body.toLowerCase().includes('size') }
            : { seq: r.seq, rating_bin: 'scenario', topic: 'usage mismatch', severity: null, supports_listing_fix: null },
    );

const stubThemes = (tags: Tag[]): Theme[] => {
    const complaints = tags.filter(t => t.rating_bin === 'complaint');
    const praises = tags.filter(t => t.rating_bin === 'praise');
    const seqs = tags.map(t => t.seq);
    const pick3 = [seqs[0], seqs[1] ?? seqs[0], seqs[2] ?? seqs[0]];
    return [
        ...(complaints.length
            ? [{ theme: 'durability / description mismatch', frequency: complaints.length, severity_avg: 4, sample_seqs: pick3, root_cause: 'quality' as const, listing_action: 'add accurate dimensions and material specs to bullet points' }]
            : []),
        ...(praises.length
            ? [{ theme: 'good value for price', frequency: praises.length, severity_avg: 0, sample_seqs: pick3, root_cause: 'expectation_gap' as const, listing_action: 'highlight value messaging in title' }]
            : []),
    ];
};

const stubReport = (themes: Theme[], n: number): Report => ({
    executive_summary: `[DRY-RUN 桩数据] 基于 ${n} 条评论，共 ${themes.length} 个主题。最大风险与主题 1 相关。此报告仅验证链路，非真实分析。`,
    top_strengths: themes.filter(t => t.severity_avg === 0).map(t => ({ theme: t.theme, frequency: t.frequency })),
    top_risks: themes.filter(t => t.severity_avg > 0).map(t => ({ theme: t.theme, frequency: t.frequency })),
    buyer_personas: ['multi-pet household owner'],
    listing_rewrite_checklist: ['add accurate dimensions', 'set correct expectations in images'],
    verdict: 'improve-first',
});

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
        if (DRY_RUN) {
            tags.push(...stubTags(batch));
            console.error(`  [stage1/${i / BATCH + 1}] dry-run stub`);
            continue;
        }
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
    const reviews = z.array(ReviewSchema).parse(JSON.parse(readFileSync(inputPath, 'utf-8')));
    const reviewsById = new Map(reviews.map(r => [r.seq, r]));

    console.error(`==> 共 ${reviews.length} 条评论，${DRY_RUN ? 'DRY_RUN 桩模式' : `模型 ${MODEL}`}`);
    const t0 = Date.now();

    const tags = await runStage1(reviews);
    const themes: Theme[] = DRY_RUN
        ? stubThemes(tags)
        : (await callJSON(
              z.object({ themes: z.array(ThemeSchema).min(1).max(8) }),
              stage2Prompt(tags, reviewsById),
              'stage2',
          )).themes;
    const report: Report = DRY_RUN
        ? stubReport(themes, reviews.length)
        : await callJSON(ReportSchema, stage3Prompt(themes, reviews.length), 'stage3');

    const cost = (totalTokens.input / 1e6) * PRICE.input + (totalTokens.output / 1e6) * PRICE.output;
    const out = {
        meta: { model: DRY_RUN ? 'dry-run-stub' : MODEL, reviewCount: reviews.length, cost_usd: +cost.toFixed(4), tokens: totalTokens },
        report,
        themes,
    };
    writeFileSync('report.json', JSON.stringify(out, null, 2));
    console.error(`==> 完成 ${((Date.now() - t0) / 1000).toFixed(1)}s，成本约 $${cost.toFixed(4)}，已写入 report.json`);
    console.log(JSON.stringify(out.report, null, 2));
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
