# RESUME.md — 会话恢复指南（新会话/未来的我先读这个）

> 最后更新：2026-10-12 19:40 | 项目：亚马逊评论 VOC 分析工具（副业，赚工具钱）
> 位置：`~/Documents/projects/voc-tool`（GitHub 私有仓库：git@github.com:zhaochangji/voc-tool.git，SSH 已配好）

## 一句话现状

**Phase 1 MVP 已全部完成**：采集→分析→报告→引用校验全链路跑通，第一份真实报告已产出（Veken 猫饮水机，40 条真实评论，$0.0036/10.5s，引用 18/18 真实零幻觉）。**下一步是 Phase 2 获客**（发帖弹药已到手）。

## 产品定义（已定稿，别再摇摆）

- 定位：面向亚马逊中小卖家的**差评雷达 + 选品避坑器**（输入竞品 ASIN → 可执行报告）
- 差异化：`sample_seqs` 强制引用原文（防幻觉，卖家可信）+ `supports_listing_fix` 字段（区分"改文案能救"vs"质量问题"）
- 定价：$19/月（5 ASIN + 差评监控）；免费额度 1 ASIN/月
- **止损线：总现金 ≤ $200 或 3 个月内 < 10 付费用户 → 换方向（管线与采集层可复用）**
- 90 天路线详见 `ROADMAP.md`

## 怎么跑（全部实测可用）

```bash
cd ~/Documents/projects/voc-tool
npm install

# 采集（Pangolinfo MCP，5积点/页，每页10条，Key 在 .env）
npm run collect -- --keyword "cat water fountain"           # 搜索→自动选非赞助ASIN
npm run collect -- --asin B0FPFZ7XFJ --critical 3 --positive 1

# 分析（DeepSeek，配置见 .env；输入支持裸数组或 collect 产物）
npm run analyze -- sample-data/real-B0FPFZ7XFJ.json         # → report.json + 终端打印报告
VOC_DRY_RUN=1 npm run analyze -- sample-data/example.json    # 无 Key 验证链路（桩模式）

npx tsc --noEmit                                            # 类型检查
```

## 技术架构（3 个文件，全部 typecheck 通过）

- `src/collect.ts` — Pangolinfo MCP 采集端（SSE JSON-RPC、2QPS 节流、reviewId 去重、积点统计、字段映射）
- `src/pipeline.ts` — 三段式 LLM 管线（Stage1 批量打标 20条/次 → Stage2 聚类成主题 → Stage3 报告合成），含 zod Schema 校验、失败重试、token 成本统计、DRY_RUN 桩模式
- `sample-data/real-*.json` — 真实数据；`report.json` — 最新报告产物

**接入细节**（端点/工具参数/返回字段映射/6个实测坑）全部在 `PANGOLIN-MCP.md`，是实测结论，别再重新调研。

## 凭据（全在 `.env`，已 gitignore，勿提交）

- `PANGOLINFO_API_KEY` — JWT 格式，约 14 天有效期（2026-10-24 前后到期要换）
- `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `VOC_MODEL` — 当前是 DeepSeek（`https://api.deepseek.com` + `deepseek-chat`）
- ⚠️ 两个 Key 都曾在聊天记录暴露过，Phase 2 发帖前建议各自轮换

## 实测成本（2026-10-10，deepseek-chat）

| 项 | 实测值 |
|---|---|
| 40 条评论分析 | $0.0036 / 10.5s（原估 $0.3-0.8，DeepSeek 打穿成本模型，1000 条 ≈ $0.05-0.1） |
| 采集 40 条 | 36 积点 / 63s（约 ¥2-3，主要变动成本，可多用户复用） |
| 毛利推算 | $19 订阅毛利率 >99% |

## 已修复的坑（避免重蹈）

1. **zod 泛型陷阱**：`z.ZodType<T>` 会把 T 推成输入类型（default 字段变 optional）→ 参数用结构化 `{ parse: (data:unknown)=>T }`
2. **模型不填 seq**（Stage1）→ Schema 放宽 nullish + 按批次顺序回填 + 乱序集合校验
3. **主题超限/引用不足**（Stage2）→ themes 1-10、sample_seqs 1-3
4. **Pangolinfo 坑**（详见 PANGOLIN-MCP.md）：2QPS 并发上限、无评论页 ASIN 仍扣 5 积点、AUTH 失败是业务码 1004 非 HTTP 401
5. ⚠️ **本地文件被外部回退**：`pipeline.ts` 被反复回退 3+ 次（疑似 IDE 旧缓冲区覆盖保存）。**恢复方法：`git checkout src/pipeline.ts`**。若再遇到"类型错误突然回来"，先怀疑回退

## 已知未修问题

（暂无 —— Strengths 混淆已于 2026-10-10 修复：主题加 kind 双组聚类，验证通过：优点栏=Quiet operation/Stainless steel hygiene/Large capacity，风险栏=Pump clogging/Water noise/Pump failure）

## 最新里程碑（2026-10-12 下午）

- [x] **Web UI 完成**：`npm run web` → localhost:8787 → 输入 ASIN 一键出双语报告（编排 CLI，串行锁，端到端已验证）
- [x] 渠道策略修订：知无不言付费墙放弃；Reddit 发帖被 Rule 2 拦 → 改 A/B 双路（B=纯案例帖先行，A=modmail 申请）；AMZ123 反广告拦截 → 降敏版纯案例帖
- [x] 3 星中评批次补齐（three_star，验证挖出价格/配送/包装 3 个新主题）
- [x] 竞品分析 COMPETITORS.md、POSTS.md 发帖文案包（含执行手册）
- [x] 跨类目验证 4 个：宠物×2 / 耳机（薄样本）/ 存储卡（大样本，最佳）

## 方案① 兑换码自助下单——移动端设计约束（2026-10-12 定，实现前必读）

**核心事实：闲鱼买家 100% 手机端。** 三个设计变更：
1. `/redeem` 输入改为**粘贴商品链接自动提取 ASIN**（正则 /dp/([A-Z0-9]{10})），手输 ASIN 仅兜底
2. 交付物 = **响应式报告网页本身**（在线看），不做手机端 window.print；PDF 改为部署后服务端 puppeteer 生成文件链接
3. report.html 需移动端调优：正文 13px→14px+、hero 长标题溢出、触控区 ≥44px、引用块窄屏边距
4. ⚠️ 必须实测：闲鱼 App 内点站外链接的行为（webview/跳浏览器/被吞）——决定纯自动 or 半自动发链接
5. 开发清单：/redeem 页（链接提取+校验+核销 codes.json）+ report 移动端样式 + （部署后）puppeteer PDF

## 当前策略（2026-10-12 定）

**社区获客遇阻（知无不言付费墙/Reddit Rule2/AMZ123 反广告）→ 转向：Web UI + 闲鱼卖服务先行。**
- 闲鱼挂单：单份 ¥9.9-19.9，买3送1；买家发 ASIN → Web UI 跑 → 发 report.html（或转PDF）
- 边际成本 ¥0.5/单；收款信任层用闲鱼本身，不建支付系统
- 社区渠道不放弃：养号中的 AMZ123 继续，Reddit B 路案例帖照发（纯干货不引流）

## 改进清单（Backlog）

- [x] 免费采集链路打通：Apify jdtpnjtp/amazon-reviews（web_wanderer 免费版不可用，勿回头）
- [x] 报告双语一键切换（管线双语言生成 + render 切换按钮）
- [x] 跨类目验证 3 个类目：宠物（2）/ 耳机（薄样本）/ 存储卡（大样本）——全部通过，25/25 引用
- [x] 竞品分析 COMPETITORS.md（差异化：全场独有的"结论点开原评论"）
- [x] analyze 多文件警告（防 real-*.json 通配符误用）
- [x] USER-GUIDE 全面刷新（三步流程/免费链路/新坑）

## 改进清单（Backlog）

1. ~~3 星中评缺失~~ ✅ 已修（three_star 批次）
2. report.html 打印/PDF 按钮
3. 卖家精灵/Shulex 亲测（对比图+定价核实）
4. Key 轮换（Apify/DeepSeek/Pangolinfo 均在聊天暴露过）
5. 监控模式（recent 排序+增量+推送）
6. 文件回退根因（疑似 IDE 旧缓冲区；用户需关闭旧标签页）

## Phase 2 待办（下一步，按此顺序）

1. 发帖文案：知无不言/创蓝《免费帮 20 位卖家分析竞品差评》+ Reddit r/FulfillmentByAmazon 英文版
2. 收集 20 内测用户，目标 7 人主动问付费
3. Web UI（Next.js + Vercel + Supabase 免费层）可以等有内测用户反馈再做
4. Prompt 调优：跑 3 个不同类目 ASIN，对比打标准确率（当前仅验证过宠物用品类）

## 90 天路线速查

Phase 0 设计 ✅ → Phase 1 MVP ✅ → **Phase 2 验证获客 ⏳（当前）** → Phase 3 加固（监控推送/Chrome 插件/MCP skill 分发）→ 12 月检查：10 付费用户或换方向
