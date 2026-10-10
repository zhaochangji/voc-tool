# Pangolinfo MCP 接入笔记（实测验证 2026-10-10）

## 端点与认证

- **MCP（推荐，工具最全）**：`https://mcp.pangolinfo.com/mcp`，Streamable HTTP（SSE 响应）
  - POST JSON-RPC，头 `Authorization: Bearer <JWT Key>`，`Accept: application/json, text/event-stream`
  - 响应取 `data: {...}` 行
- **REST Scrape API（部分功能）**：`POST https://scrapeapi.pangolinfo.com/api/v1/scrape`（必须 https）
  - `{url, parserName: "amzProductDetail", formats: ["json"]}`，`data.json[0].data.results[0]`
- Key 为 JWT 格式（`eyJhbGci...`），env 名 `PANGOLINFO_API_KEY`

## 关键工具（MCP tools/call）

| 工具 | 参数 | 积点 | 实测 |
|---|---|---|---|
| `search_amazon` | `{keyword, site:"amz_us"}` | 1 | ✅ 拿 `results[].asin`（跳过 `sponsored!="0"`） |
| `get_amazon_product` | `{asin, site}` | 1 | ✅ 30+ 字段，含 `aiReviewsSummary`/`ratingDistribution` |
| `get_amazon_reviews` | `{asin, site, pageCount, filterByStar: "critical"\|"positive", sortBy:"helpful"}` | 5/页 | ✅ **每页 10 条** |

## get_amazon_reviews 返回字段 → 我们的 ReviewSchema 映射

`data.json[0].data.results[]`，字段：`asin, author, authorId, content, country, date, helpful, imgs, purchased, reviewId, star, title, videos, vineVoice`

映射：
- `review_id` ← `reviewId`
- `rating` ← parse `star`（"3.0 out of 5 stars" → 3）
- `verified` ← `purchased`（注意可能是字符串，需要判断真值）
- `title`/`body` ← `title`/`content`
- `review_date` ← `date`（"September 30, 2026"）
- `seq` ← 序号（去重键 reviewId）

## 坑（实测+官方 SKILL.md R-12 整理）

1. **并发硬上限 2 QPS**，3 并发触发业务码 9200 "no content"
2. 无评论页的 ASIN 返回 `code:0 "Review page not found"` **但仍扣 5 积点** → 先用 `get_amazon_product` 的 `rating`（评论数）确认 >100 再拉
3. AUTH 失败是业务码 1004（不是 HTTP 401）；同 key 重试必然再失败，绝不重试
4. `aiReviewsSummary`（PDP 自带，0 额外积点）已含 LLM 摘要+原文引用，轻量报告可先用它
5. 速率限制下重试：等 1-5s 只重试失败那一个
6. 其他工具：`list_bestsellers`/`filter_niches`/`wipo_search`(USID)/`ai_search`/`keyword_trends`/`pangolinfo_capabilities`(免费探针)

## 下一步：collect.ts 设计

```
1. search_amazon(keyword) → top ASIN（跳过 sponsored）
2. get_amazon_product(asin) → 校验 rating 评论数 > 100，存 title/star/price/aiReviewsSummary
3. get_amazon_reviews(asin, filterByStar=critical, pageCount=1..N) → 差评池
   get_amazon_reviews(asin, filterByStar=positive, pageCount=1..N) → 好评池（可选）
4. 映射为 reviews.json（seq 从 1 递增，reviewId 去重）→ 喂 pipeline.ts
```
