# POSTS.md — Phase 2 获客发帖文案（2026-10-12）

> 使用前必读《发帖执行手册》（文末）。核心原则：**展示价值，不吹嘘；给足干货，再要 ASIN；不提成本/模型/爬虫细节。**

---

## 一、中文社区版（AMZ123 / 雨果网 / 福步 / 创蓝 通用）

> 注：知无不言已改为付费注册，中文主阵地改为 AMZ123（免费、亚马逊垂类最准）；同一份文案可在雨果/创蓝/福步复用，注意各站首发标记。

### 标题（三选一，推荐 A）

- A：`【免费福利】把竞品的 50 条差评拆成一张"Listing 改写清单"——每个结论都能点开看原评论，限 20 个 ASIN`
- B：`做了个差评拆解工具，免费帮 20 位坛友分析竞品（附 SanDisk 存储卡实战案例）`
- C：`行研分享：SanDisk High Endurance 的 14 条差评都在骂"行车记录仪里过早失效"——顺便送 20 个免费分析名额`

### 正文

---

各位好，最近写了个小工具，功能就一件事：**输入一个竞品 ASIN，把它最有价值的 50 条评论（1-2 星差评 30 条 + 3 星中评 10 条 + 5 星好评 10 条）拆成一份可执行的分析报告**。

先说差异点：市面上的评论分析工具我理解都是给你"维度图表"，我的报告里**每个结论后面都挂着引用的原评论**——点开就能看到"这个差评主题到底是谁在骂、骂的什么"，不是模型自己编的。

**拿 SanDisk High Endurance 256G（B07P4HBRMV）实战了一下，截几张图给大家看效果：**

【截图 1：报告头图 + 判定徽章】
【截图 2：风险/优点双栏】
几个有意思的发现：
- 头号风险是"**存储卡在行车记录仪/监控设备中过早失效**"（30 条差评里 14 条在骂这个）——一款叫 High Endurance 的卡，最被骂的恰恰是耐久，这个反差对入场决策很关键；
- 3 星中评挖出了 1-2 星里看不到的主题：**价格偏高/涨价、配送延迟、包装难开**——3 星的买家是在告诉你"怎么改就能变 4 星"；
- 判定结论是"先改后卖"，报告里给了 7 条按优先级排的 Listing 改写清单，比如"明确标注不适用持续写入型设备"、"列出已知不兼容设备型号（Vantrue、Tapo 等）"。

【截图 3：主题卡点开原评论引用】← 这是和"图表型工具"最大的区别
【截图 4：改写清单】

**报告是双语的（右上角一键切中/EN），可以拿去直接给美国运营看。**

---

### 免费名额规则

- **限 20 个 ASIN，每人 1 个，先到先得**；
- 回帖或私信发我 ASIN（**评论 500 条以上的效果最好**，差评池才够拆）；
- 24 小时内回你一份 HTML 报告（可转发给你团队）；
- 无套路：不收费、不收集手机号、不用注册任何东西。我在验证这个工具对卖家到底有没有用，你只需要回一句"报告里哪条对你有用、哪条是废话"。

——

*工具就干这一件事，不做选品不做广告不做 ERP，也不是卖家精灵那种全家桶的替代品。坛规如限推广我会配合调整。*

---

## 二、Reddit 版（r/FulfillmentByAmazon，英文）

### 标题

`I built a tool that turns a competitor's reviews into a listing rewrite checklist — every claim links back to the original review. First 20 ASINs get one free, no strings.`

### 正文

---

Context: I'm an indie dev validating a product idea. Not a pitch — you get a free report, I learn whether this is useful. Sharing because the output seems genuinely valuable.

**What it does:** you give me an ASIN, it pulls the 30 most helpful 1-2★ reviews, 10 three-star reviews, and 10 five-star reviews, then produces a report:
- Top risks & strengths, clustered into themes with frequency counts
- **Every theme cites the actual reviews it's based on** (click and read the original text — no black-box AI claims)
- Root-cause labels (quality / size mismatch / listing-misleading / expectation gap)
- A prioritized listing rewrite checklist
- Clean single-page HTML report you can share with your team

**Example — SanDisk High Endurance 256GB (B07P4HBRMV, ~5k+ ratings):**

The #1 risk theme was *premature card failure in dash cams and security cams* — 14 of the 30 critical reviews. Ironic for a card literally named "High Endurance". The 3-star reviews surfaced things invisible in 1-2★ reviews: price creeping up, shipping delays, hard-to-open packaging.

Verdict: improve-first. Top checklist items: clearly state the card isn't suited for continuous-write devices, list known-incompatible camera models (Vantrue, Tapo came up repeatedly), publish a real operating-temp limit.

**The offer:** drop an ASIN below (ideally 500+ ratings so the critical pool is thick). First 20 get a full HTML report back within 24h. All I ask in return: tell me which parts of the report were useful and which were noise.

Happy to answer questions about how it works (data comes from a licensed scraping service, not me hammering Amazon).

---

**发帖后立即以楼主身份回帖的 FAQ 评论（直接复制）：**

> **FAQ, answering up front:**
> - **Where does the data come from?** A licensed scraping API (paid per result). I'm not hitting Amazon directly.
> - **Do you store my ASINs or ask for email?** No. Report is generated on demand and nothing is tied to you — just drop the ASIN in the comments.
> - **Why free?** I'm validating whether this workflow is useful before building anything bigger. Your feedback IS the payment.
> - **What if my product has few reviews?** Below ~200 ratings the report gets thin — I'll tell you the ASIN isn't a good fit rather than send you junk.

## 三、发帖执行手册

### 截图清单（发帖前拍好）

| # | 内容 | 用于 |
|---|---|---|
| 1 | 报告头图（产品名+星级+判定徽章） | 两版头图 |
| 2 | 风险/优点双栏 | 两版 |
| 3 | **主题卡点开后的原评论引用**（最重要的一张） | 两版——差异化卖点全靠它 |
| 4 | 中/EN 切换动图或前后两张 | 两版 |
| 5 | SanDisk"过早失效"主题卡 | 正文案例 |

拍图注意：**报告中/英文各来一套**；截图里别带你的文件路径。

### 渠道与时机（2026-10-12 修订：知无不言付费墙，全部免费渠道）

| 优先级 | 渠道 | 注册 | 注意 |
|---|---|---|---|
| ① | **Reddit r/FulfillmentByAmazon** | 免费 | **建议首发**（免费+英文报告就绪+受众最大）；先读版规；北京时间晚 9-11 点发（美区早高峰） |
| ② | **AMZ123 卖家论坛**（bbs.amz123.com） | 免费 | 亚马逊垂类最准；新人号可能有限发帖等级，注册后先签到/回帖养号 1-2 天再发主帖 |
| ③ | 雨果网（cifnews.com 社区） | 免费 | 跨境人群广；注册后可发帖，发在运营/Listing 相关板块 |
| ④ | 创蓝论坛 / 福步（亚马逊板块） | 免费 | 同一份文案复用；注意各站规则 |
| 长尾 | 知乎（回答"亚马逊差评/竞品分析"类问题，文末附免费分析名额）+ 小红书（跨境运营图文） | 免费 | 不发帖而是答题/种草，长期引流 |

> 放弃：知无不言（付费注册，ROI 不合适——等有付费用户后再考虑买个号发）

### 名额运营（人肉阶段）

建一张表记：`| 日期 | 社区 | 昵称 | ASIN | 品类 | 已交付 | 反馈摘要 | 主动问付费? |`
- 交付 SLA：24h（超了宁可熬夜也守，前 20 个口碑=种子用户）
- 每份反馈记一句话——"哪条有用/哪条是废话"就是需求池
- **有人问"多少钱/怎么长期用"→ 记录，这就是付费信号（目标 7 人）**

### 红线（别踩）

1. 不提成本、模型名、爬虫细节（中文版把"licensed scraping service"那句删了，只在 Reddit 透明声明里保留）
2. 不贬低卖家精灵/Shulex（提也别提名）
3. 不承诺"包出爆款/必涨转化"
4. 数据不足就明说"这个 ASIN 差评太少，效果不好"——首评口碑比成交重要

### 判定标准（48 小时复盘）

- 20 名额 < 2 小时被抢完 → 需求强，加速 Web UI
- 24h 内 ≥ 7 人问付费 → Phase 3 全速
- 名额领得慢 / 反馈冷淡 → 换切入点（合规工具/站外 VOC）再试一轮
