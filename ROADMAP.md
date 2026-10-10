# voc-tool 90 天路线图（执行跟踪）

> 定位：面向亚马逊中小卖家的评论 VOC 分析工具（差评雷达 + 选品避坑）
> 定价：$19/月（5 ASIN + 差评监控）；止损线：总现金 ≤ $200 或 3 个月内 < 10 付费用户

## Phase 0 · 设计（✅ 已完成 2026-10-10）

- [x] 方向选定：评论 VOC 分析（对比 AI 文案/合规/客服外包四个方向）
- [x] 竞品与定价空档分析（Shulex/Helium10/卖家精灵）
- [x] 数据库设计（7 表：products/reviews/monitors/reports/alert_events/usage_logs…）
- [x] LLM 三段式管线设计（打标→聚类→报告，sample_seqs 强制引用防幻觉）
- [x] 成本测算：一次性 $50-100 + 60-120 小时；运行月成本 $10-180

## Phase 1 · MVP（⏳ 进行中，目标 11 月中）

- [x] 管线代码脚手架（src/pipeline.ts + Schema 校验 + 重试 + 成本统计）
- [x] DRY_RUN 桩模式端到端验证通过（无 API Key 可跑通全链路）
- [ ] 真实 LLM 首跑：`OPENAI_API_KEY=xxx npm run analyze -- sample-data/example.json`（成本预期 <$0.01）
- [ ] 注册 Pangolin/ScraperAPI 免费层，拉取 1 个真实 ASIN 的 100+ 条评论
- [ ] 用真实数据产出**第一份真实报告**（= 发帖获客弹药）
- [ ] Prompt 调优：跑 3 个不同类目 ASIN，对比打标准确率
- [ ] Next.js Web 端（登录 / 提交 ASIN / 报告展示页 / Stripe 或 Lemon Squeezy）
- [ ] 部署上线（Vercel + Supabase + 域名）

## Phase 2 · 验证获客（目标 11 月底）

- [ ] 知无不言/创蓝发帖：《免费帮 20 位卖家分析竞品差评》（附真实报告截图）
- [ ] Reddit r/FulfillmentByAmazon 工具分享帖
- [ ] 收集 20 个内测用户，目标 7 人主动询问付费
- [ ] 达到 10 个付费用户 → 进入 Phase 3；否则评估换方向（复用采集层+管线）

## Phase 3 · 加固（12 月，视验证结果）

- [ ] 差评监控 + 推送（cron 增量拉取，v0.5 核心付费点）
- [ ] Chrome 插件（Amazon 页面一键分析）
- [ ] MCP skill 分发（Claude/Codex 内使用）
- [ ] 竞品对比报告 / 缺陷归因到 SKU

## 运行成本红线

- LLM 每报告 $0.3-0.8（gpt-4o-mini，实际值以首跑为准）
- 采集 API $0-50/月（免费层起步）
- 免费用户限额：1 ASIN/月 + 500 条评论上限
