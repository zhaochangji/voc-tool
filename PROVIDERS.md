# PROVIDERS.md — 采集供应商策略与对比（测试期免费优先）

> 决策（2026-10-10）：测试阶段用免费/有额度的方案；对比出效果后，正式期谁效果好+划算用谁（架构上已做成 `--provider` 切换，换供应商=零成本）。

## 候选评测

| 供应商 | 费用 | 40 条成本 | 状态 |
|---|---|---|---|
| **Apify** `web_wanderer/amazon-reviews-extractor` | **免费版每月 $5 额度**；$1.10-1.80/千条 | ~$0.05 | ⏳ 当前默认（待 Token 实测） |
| Pangolinfo MCP | $19/月 | ~22 积点 | ✅ 已跑通（免费积分已用完，未充值） |
| Keepa | ~€49/月 | — | ❌ 无评论全文 |
| Amazon SP-API | 免费 | — | ❌ 不提供竞品评论 |
| Rainforest/ScraperAPI | $49-79/月 | — | ❌ 贵 |
| RapidAPI 杂牌 | 免费档 | 低 | 备胎，质量未验证 |
| Chrome 插件自采 | $0 | $0 | 终局方案（Phase 3） |

## Apify 供应商详情（已调研）

- Actor：`web_wanderer~amazon-reviews-extractor`（5766 用户，40 万次运行，20+ 站点）
- 输出字段比 Pangolinfo 更富：`reviewId, rating, verifiedPurchase, vineReview, reviewTitle, reviewText, reviewDate, helpfulVoteCount, language, country, aspects(维度情感!), reviewsAISummary, ratingSummary`
- 每商品最多 100 条（"All Stars" 模式 500+）
- **输入字段未公开文档**——拿到 Token 后先调 `GET https://api.apify.com/v2/acts/{actorId}/input` 拿默认输入校准 `APIFY_INPUT_JSON`（collect.ts 里标注了 ⚠️）
- 计费按结果（~$1.8/千条），免费 $5/月 ≈ **2780 条 ≈ 60-100 份报告**

## 评测标准（正式期选型用，跑完 3-5 个品类后填写）

| 维度 | Pangolinfo | Apify |
|---|---|---|
| 评论字段完整度（VP/Vine/helpful/图）| ✅ | ✅（+aspects 维度情感）|
| 每商品可拉条数上限 | 翻页不限 | 100（All Stars 500）|
| 差评定向能力（省成本）| ✅ filterByStar=critical | ❌ 全量拉回本地过滤 |
| 单报告成本 | ~22 积点（月付 $19 内） | ~$0.05 |
| 关键词搜索选品 | ✅ search_amazon | 需另接搜索 actor |
| 稳定性/数据新鲜度 | 待对比 | 待对比 |
| LLM 增强（aiReviewsSummary）| ✅ | ✅（reviewsAISummary）|

## 用法

```bash
npm run collect -- --provider apify --asin B00CPDWT2M      # 默认（.env PROVIDER 也行）
npm run collect -- --provider pangolin --keyword "..."    # 效果对比
```

## 国际平台扩展实测（2026-10-12，Apify 商店公开数据）

| 平台 | 成熟度 | 推荐采集器 | 状态 |
|---|---|---|---|
| **Walmart** | ★★★★★ | `e-commerce/walmart-reviews-scraper`（577 用户）| 可接入（第一优先）|
| **Etsy** | ★★★★ | `hello.datawizards/etsy-reviews`（505 用户）| 可接入（等需求）|
| **AliExpress** | ★★★★ | `crowdpull/aliexpress-reviews-scraper`（240 用户）| 可接入（等需求）|
| **Temu** | ★★ | ❌ 只有商品采集器，无评论采集器 | 暂缓（上新快，评论生态不成熟）|
| **eBay/TikTok Shop** | ★ | 无成熟商品评论采集器 | 暂缓 |

- 全部 PAY_PER_EVENT 计费，**共用 Apify $5/月免费额度**（一张额度刷全平台）
- 接入方式：provider 适配器加 platform 映射，每平台半天（字段映射为主）
- 策略：**先只在 Amazon 上验证商业模式**；有买家提出跨平台需求再接 Walmart；其余等真实需求
