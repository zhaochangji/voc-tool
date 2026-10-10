# voc-tool（评论 VOC 分析管线 · MVP）

三段式 LLM 管线：打标 → 聚类 → 报告。含 JSON Schema 校验、重试、成本统计。

## 快速开始

```bash
npm install
export OPENAI_API_KEY=sk-xxx        # 或用任何 OpenAI 兼容端点
npm run analyze -- sample-data/example.json
# 产物：终端打印报告 + report.json（含 themes + 成本 meta）
```

输入格式：`[{seq, rating, verified, title, body, review_date}, ...]`（真实场景由采集 API 产出后映射到此结构）。

## 管线结构

| Stage | 作用 | 批次 | 输出 |
|---|---|---|---|
| 1 | 单条打标（praise/complaint/scenario/persona/suspect + 是否可改 Listing 缓解） | 20 条/次 | tags |
| 2 | 聚类成主题，**强制 sample_seqs 引用原文**（防幻觉） | 全量 1 次 | themes |
| 3 | 报告合成（摘要/风险/画像/清单/verdict） | 1 次 | report |

## 增量刷新（v0.5 用）

只对**新评论**跑 Stage1，把新 tags 与旧 themes 合并后再跑 Stage2 —— 单次刷新成本约为全量的 1/10。

## 下一步

1. 接采集 API（Pangolin/ScraperAPI）→ 产出真实 ASIN 的 reviews.json
2. 差评监控：cron 按 `last_sync_date` 拉增量，新评论 rating<=3 触发推送
3. 外包 UI（Next.js）读取 report.json 展示
