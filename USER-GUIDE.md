# USER-GUIDE.md — 操作手册（你自己就是第一个用户）

> 给谁看：wb_zhaochangji（工具作者兼 0 号用户）
> 目标：从零跑通"输入一个品类词 → 拿到一份能发给别人看的报告"，知道每一步花多少钱、哪里会翻车

---

## 0. 你手里的工具是什么（一句话）

**输入一个亚马逊品类词（或 ASIN），自动拉取该产品最狠的 40 条差评+好评，10 秒内产出一份"缺陷归因 + Listing 改写清单"的分析报告。**

两步命令：

```
npm run collect -- --keyword "cat water fountain"    # 第一步：采集（花钱买数据）
npm run analyze -- sample-data/real-XXX.json        # 第二步：分析（花 LLM 的钱）
```

---

## 1. 三把钥匙（`.env` 文件，就在项目根目录）

| 变量 | 是什么 | 在哪看余额/到期 |
|---|---|---|
| `PANGOLINFO_API_KEY` | 采集层的钥匙（拉亚马逊数据）| 登录 tool.pangolinfo.com → 控制台看积分。**JWT 有效期约 14 天，到期前在官网重新生成并更新 `.env`** |
| `OPENAI_API_KEY` | 分析层的钥匙（当前是 DeepSeek）| 登录 platform.deepseek.com → 充值/查看余额。余额不足会 402 报错 |
| `OPENAI_BASE_URL` + `VOC_MODEL` | 告诉工具 LLM 端点和模型在哪 | 不用动，当前 `https://api.deepseek.com` + `deepseek-chat` |

⚠️ 改完 `.env` 不需要重启什么，每次运行都会重新读取。

---

## 2. 三种使用场景

### 场景 A：我只有个品类想法（最常用，选品/避坑）

```bash
cd ~/Documents/projects/voc-tool
npm run collect -- --keyword "cat water fountain"
```

工具自动做的事：
1. 搜索该关键词 → 取**排名第 1 的非赞助商品**作为分析对象（想换就自己从 Amazon 复制个 ASIN 用场景 B）
2. 拉它的商品信息（校验评论数、记标题）
3. 拉差评 3 页（30 条）+ 好评 1 页（10 条）
4. 写入 `sample-data/real-<ASIN>.json`

**花费：约 36 积点 + $0.004 LLM｜耗时：约 1 分钟**

然后分析：

```bash
npm run analyze -- sample-data/real-<ASIN>.json
```

**花费：约 $0.004｜耗时：约 10 秒** → 报告打印在终端，完整版在 `report.json`

### 场景 B：我有具体想分析的 ASIN（竞品分析）

```bash
# Amazon 商品页 URL 里 /dp/ 后面那串就是 ASIN，如 amazon.com/dp/B0FPFZ7XFJ
npm run collect -- --asin B0FPFZ7XFJ --critical 3 --positive 1
npm run analyze -- sample-data/real-B0FPFZ7XFJ.json
```

### 场景 C：只想重跑分析（不重新花钱采集）

```bash
npm run analyze -- sample-data/real-XXX.json    # 已有的数据随便重跑，只花 LLM 的钱
```

调参数实验：改 `src/pipeline.ts` 里的 prompt → 重跑 analyze → 对比报告质量。**这是零积点成本的调优方式**。

---

## 3. 看懂报告（report.json 结构）

```jsonc
{
  "meta": {                        // 这次分析花了多少钱、多少 token —— 成本核对看这里
    "model": "deepseek-chat",
    "cost_usd": 0.0036,            // ← 每报告实际美元成本
    "tokens": { "input": 9255, "output": 2494 }
  },
  "report": {                      // ← 给卖家看的主报告
    "executive_summary": "...",    // 3 句话总结：最大风险与机会
    "top_strengths": [...],        // 优点（kind="strength" 主题，最多 3 条）
    "top_risks": [...],            // 风险（kind="risk" 主题，最多 3 条）
    "buyer_personas": [...],       // 买家画像（写文案/投广告定位用）
    "listing_rewrite_checklist": [ // ★ 核心交付物：按风险排序的 Listing 改写清单
      "Replace 'whisper quiet' claims with a realistic decibel range..."
    ],
    "verdict": "improve-first"     // 选品判定：buy-to-sell / improve-first / avoid
  },
  "themes": [                      // ← 报告背后的中间层数据（可信度来源）
    {
      "kind": "risk",              // risk=抱怨主题, strength=好评主题
      "theme": "Pump clogging and frequent deep cleaning",
      "frequency": 5,             // 40 条评论里 5 条在骂这个
      "severity_avg": 4.2,        // 痛程度 0-5
      "sample_seqs": [1, 5, 9],   // ★ 引用的原评论序号 → 去 real-XXX.json 里查 seq=1 的原文（防幻觉设计）
      "root_cause": "quality",    // 归因：质量/尺寸不符/文案误导/包装/物流/期望落差
      "listing_action": "..."      // 对应的改写动作
    }
  ]
}
```

**验证报告可信度的方法（你每个报告都该抽查一次）**：
打开 `sample-data/real-XXX.json`，找 `seq` = `sample_seqs` 里的数字，看原评论是不是真的在骂这个主题。18/18 全中才算合格——这是你跟"ChatGPT 手动粘贴"的本质区别，也是发帖时最硬的展示点。

---

## 4. 坑与排错表（按痛度排序）

| 症状 | 原因 | 处理 |
|---|---|---|
| collect 报 `AUTH`/业务码 1004 | Pangolinfo Key 过期（**14 天必过期，最常见**）| 官网 tool.pangolinfo.com 重新生成 Key → 更新 `.env` 的 `PANGOLINFO_API_KEY` |
| 报 `QUOTA` | 积分不足 | tool.pangolinfo.com 充值；或先用 `--critical 1` 少拉点 |
| analyze 报 402 / Insufficient Balance | DeepSeek 没余额 | platform.deepseek.com 充值（$5 能跑上千个报告） |
| 差评条数 0 / "Review page not found" | 该 ASIN 没有可见评论页，**且已扣 5 积点** | 先用 `get_amazon_product` 确认评论数 >100 再拉；换有评论的 ASIN |
| analyze 报 `Schema 校验失败` 两次 | 模型抽风输出了不合规格的 JSON | 直接重跑一次（temperature=0，一般重跑就过）；连续失败 → 把报错贴给 AI 排查 |
| `stage1` 报 seq 不匹配 | 模型乱序输出 | 同上，重跑 |
| **文件内容"变回去了"/类型错误诡异地回来** | 已知环境问题：本地文件偶发被旧缓冲区覆盖 | `git checkout -- src/pipeline.ts` 一键恢复；恢复后重跑 |
| 评论全是 3 星，没有 1-2 星 | `sortBy=helpful` 会优先返回最有帮助的（往往 3 星最详细）| 已知特性，暂不用管；要更狠的差评把 `--critical` 页数拉大 |

---

## 5. 第一次实操练习（10 分钟，做完你就出师了）

1. **自己选个品类**（建议选你感兴趣的：`"wireless earbuds"` / `"dog harness"` / `"silicone spatula"`）
2. 跑采集：`npm run collect -- --keyword "你选的词"`
3. 跑分析：`npm run analyze -- sample-data/real-<输出的ASIN>.json`
4. 打开 `report.json`，找到 `top_risks` 第一条的 `sample_seqs`，去数据文件里对照原评论
5. 自问三个问题：
   - 这个产品的头号风险是什么？（`top_risks[0]`）
   - 如果我是卖家，清单里哪条我立刻会去改？（`listing_rewrite_checklist`）
   - verdict 让我入场吗？（`verdict`）
6. **翻车了就把报错完整贴给 AI**，报错里有 `[stageX]` 标记，能直接定位

---

## 6. 日常操作速查卡

```bash
# 全流程（关键词）
npm run collect -- --keyword "品类词" && npm run analyze -- sample-data/real-*.json

# 全流程（指定 ASIN，控制预算）
npm run collect -- --asin B0XXXXXX --critical 1 --positive 0   # 最省钱：5积点看10条差评

# 类型检查（改代码后必跑）
npx tsc --noEmit

# 无 LLM Key 验证链路（改了编排逻辑后快速回归）
VOC_DRY_RUN=1 npm run analyze -- sample-data/example.json

# 恢复被回退的文件（万能后悔药）
git checkout -- src/pipeline.ts
```

**预算感**：一个完整报告 ≈ 36 积点 + $0.004 ≈ **¥3 以内**。免费额度 200 积点 ≈ 5-6 个完整报告，练手足够。

---

## 7. 还没做、但迟早要的（别现在问在哪）

- `report.html` 可视化报告页（双击浏览器打开，发帖截图用）— 排在 Phase 2 开头
- 差评监控推送（cron + 邮件）
- 多 ASIN 对比报告
