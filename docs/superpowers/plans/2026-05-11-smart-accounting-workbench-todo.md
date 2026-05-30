# Smart Accounting Workbench TODO

**Goal:** 将首页改造成“智能做账工作台”，通过规则和科目余额引导不熟悉做账流程的财务人员完成本月做账。

## Scope

- [x] 首页 `/` 展示智能做账工作台。
- [x] 保留原首页财务指标，移到“经营概览”区域。
- [x] 新增纯函数规则引擎，按当前期间生成任务、风险和下一步建议。
- [x] 银行流水导入作为必查项。
- [x] 发票不是必导入项；本期没有发票时不提醒导入。
- [x] 固定资产相关科目有余额且本期无折旧发生额时提醒。
- [x] 待摊费用相关科目有余额且本期无摊销发生额时提醒。
- [x] 重点科目有余额但本期无变化时提示用户确认是否正常。

## Implementation Tasks

- [x] Add tests for smart accounting rule summaries.
- [x] Create `src/lib/smart-accounting-workbench.ts`.
- [x] Update `src/app/page.tsx` to use the workbench summary.
- [x] Update sidebar label from “首页” to “智能做账”.
- [x] Run TypeScript/build verification.

## Deferred

- [x] Persist “本月无需处理” confirmations.
- [x] Block `closePeriod` when blocker checks fail.
- [x] Add configurable rule switches.
- [x] Add dedicated check report page.
- [x] Block voucher writes for closed or locked accounting periods.

## 已完成的新增项

- [x] 首页增加“系统预设，用户可编辑”的状态修正区。
- [x] 任务状态支持按账套 + 期间持久化保存。
- [x] 用户可将发票、折旧、摊销等任务标记为“本月无需处理”。
