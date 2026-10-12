# USER-GUIDE.md — 操作手册（你自己就是第一个用户）

> 给谁看：wb_zhaochangji（工具作者兼 0 号用户）
> 更新：2026-10-12（双语报告 + 免费采集链路版本）
> 目标：从零跑通「输入 ASIN → 拿到中英可切的网页报告」，知道每步花多少钱、哪里会翻车

---

## 0. 工具是什么（一句话）

**输入一个亚马逊 ASIN，40 秒产出一份「缺陷归因 + Listing 改写清单」的双语网页报告，每个结论都引用真实原评论。**

## 1. 标准三步（背下来）

```bash
cd ~/Documents/projects/voc-tool
npm run collect -- --provider apify --asin B0XXXXXXX        # ① 采集（~16s，免费额度）
npm run analyze -- sample-data/real-B0XXXXXXX.json           # ② 分析（~20s，$0.005，双语）
npm run render  -- sample-data/real-B0XXXXXXX.json          # ③ 网页报告（1s，自动打开）
```

**ASIN 从哪来**：Amazon 商品页 URL 里 `/dp/` 后面那串（如 `amazon.com/dp/B07P4HBRMV`）。
**⚠️ 不要用 `real-*.json` 通配符**——会匹配多个文件，analyze 只处理第一个（现在会打警告）。直接复制 collect 结束时打印的「下一步」命令。

## 2. 三把钥匙（`.env`）

| 变量 | 用途 | 状态/坑 |
|---|---|---|
| `APIFY_TOKEN` | 采集主钥匙（默认供应商 jdtpnjtp/amazon-reviews）| 免费 $5/月额度 ≈ **60-100 份报告**，月底刷新 |
| `PANGOLINFO_API_KEY` | 备用供应商（仅 `--provider pangolin` 和关键词搜索用）| 收费 $19/月；关键词搜索会扣积分，**尽量直接给 ASIN** |
| `OPENAI_API_KEY` + `OPENAI_BASE_URL` + `VOC_MODEL` | LLM 分析（当前 DeepSeek）| platform.deepseek.com 充值，$5 用一年 |

改完 `.env` 不用重启，每次运行自动重读。

## 3. report.html 怎么看

- 右上角 **中 | EN** 一键切换（两份报告都内嵌在文件里，断网可切，直接发给别人）
- 结构：判定徽章 → 摘要 → 风险/优点双栏 → **主题明细卡（点开引用的原评论——防幻觉卖点）** → 买家画像 → 改写清单
- **每个报告抽查一次引用**：打开 `sample-data/real-XXX.json`，按 `sample_seqs` 里的 seq 找原评论对质

## 4. 已知数据特性（非 Bug，但要知道）

1. **差评池只有 1-2 星**：jdtpnjtp 的 `critical` = 1-2 星，**3 星中评缺失**（"很喜欢但是…"这类最有 VOC 价值的评论进不来）→ 已列入改进清单（Backlog #1）
2. 排序按 helpful → 老评论占比可能偏高；监控场景将来需要 recent 排序（Backlog #6）
3. 评论数 <100 的小 ASIN 差评池很薄（如 JBL 那次只有 5 条），**挑评论 500+ 的 ASIN 测**

## 5. 坑与排错

| 症状 | 原因 | 处理 |
|---|---|---|
| `[QUOTA] 积分余额不足` | pangolin 没积分（只在用 keyword/pangolin 时）| 改用 `--provider apify --asin` |
| `apify HTTP 402`/额度尽 | Apify 月度免费额度用完 | 等月底刷新或升级（$5 够用）；或临时切 pangolin |
| analyze 报 `Schema 校验失败` 两次 | 模型输出不合规格 | 重跑一次（内置 1 次重试，偶尔需手动再跑）；连败贴报错给 AI |
| ⚠️ 多文件警告 | 用了通配符 | 传完整文件名 |
| **文件"自己变回去"/类型错误复活** | 本机已知问题：文件偶发被旧缓冲区覆盖 | `git checkout -- src/xxx.ts` 一键恢复 |
| 差评 0 条 | ASIN 无差评或评论太少 | 换 ASIN |

## 6. 日常速查

```bash
# 全流程（一次一个 ASIN）
npm run collect -- --provider apify --asin B0XXX && \
npm run analyze -- sample-data/real-B0XXX.json && \
npm run render  -- sample-data/real-B0XXX.json

# 省钱模式（只看差评）
npm run collect -- --provider apify --asin B0XXX --critical 1 --positive 0

# 改代码后
npx tsc --noEmit            # 类型检查
VOC_DRY_RUN=1 npm run analyze -- sample-data/example.json   # 无 Key 回归链路

# 万能后悔药
git checkout -- src/pipeline.ts
```

**成本感**：一份完整报告 ≈ Apify $0.07 额度 + LLM $0.005 ≈ **¥0.5 以内**。

## 7. 改进清单（Backlog，按优先级）

1. **3 星中评采集**（starFilter=all_stars + 本地分流，或差评/好评各加一档）
2. 发帖文案（Phase 2 主任务）
3. report.html 加打印/PDF 按钮（卖家交付常用）
4. 卖家精灵/Shulex 亲测试用（对比图素材 + 定价核实）
5. 两个 Key 轮换（已在聊天暴露过）
6. 监控模式（recent 排序 + 增量 + 推送，Phase 3）
7. 文件回退根因排查（IDE 旧缓冲区？）
