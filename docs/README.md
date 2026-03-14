# AI 财务助手 - 项目文档中心

## 文档目录结构

```
docs/
├── README.md              # 本文档 - 文档中心导航
├── requirements/          # 需求文档
│   ├── 001-system-overview.md
│   ├── 002-functional-requirements.md
│   └── 003-non-functional-requirements.md
├── technical/            # 技术文档
│   ├── 001-architecture.md
│   ├── 002-api-spec.md
│   └── 003-component-design.md
├── database/             # 数据库文档
│   ├── 001-data-model.md
│   ├── 002-table-schemas.md
│   └── 003-index-optimization.md
├── progress/             # 项目进度
│   ├── 001-milestones.md
│   ├── 002-iteration-plan.md
│   └── 003-release-notes.md
├── tests/                # 测试文档
│   ├── 001-test-strategy.md
│   ├── 002-test-cases.md
│   └── 003-coverage-report.md
└── changes/              # 需求变更记录
    ├── 001-change-log.md
    └── 002-impact-analysis.md
```

## 文档版本控制

- 文档格式：Markdown
- 版本管理：Git
- 变更追踪：docs/changes/change-log.md
- 审核流程：需求确认 → 技术评审 → 实施开发

## 文档命名规范

```
[分类编号]-[文档类型]-[简短描述].md

示例：
- requirements/001-system-overview.md
- technical/002-api-spec.md
- database/001-table-schemas.md
```

## 快速导航

| 文档类别 | 说明 | 主要内容 |
|---------|------|---------|
| [需求文档](./requirements/README.md) | 产品需求和功能规格 | 用户故事、业务流程、功能列表 |
| [技术文档](./technical/README.md) | 技术架构和设计 | 系统架构、API设计、组件规范 |
| [数据库文档](./database/README.md) | 数据模型和表结构 | 数据字典、ER图、表设计 |
| [项目进度](./progress/README.md) | 开发进度和里程碑 | 里程碑、迭代计划、发布记录 |
| [测试文档](./tests/README.md) | 测试策略和用例 | 测试计划、测试用例、覆盖率 |
| [变更记录](./changes/README.md) | 需求变更和影响分析 | 变更日志、影响分析、决策记录 |

## 文档访问权限

- **公开文档**：README、API文档
- **内部文档**：需求文档、技术设计
- **敏感文档**：数据库设计、测试用例

## 文档更新流程

1. **创建/修改文档**
   ```bash
   # 在相应目录创建或编辑文档
   # 遵循文档命名规范
   ```

2. **记录变更**
   ```bash
   # 在 changes/change-log.md 记录变更
   # 包括：变更类型、影响范围、变更日期
   ```

3. **提交审核**
   ```bash
   # 提交 Pull Request
   # 请求相关人员审核
   ```

4. **合并发布**
   ```bash
   # 审核通过后合并
   # 更新版本号
   ```

## 文档维护

| 文档 | 更新频率 | 负责人 | 审核人 |
|------|---------|--------|--------|
| 系统概述 | 项目启动 | 产品经理 | 技术总监 |
| 功能需求 | 每次需求变更 | 产品经理 | 技术团队 |
| 技术架构 | 重大架构变更 | 架构师 | 技术总监 |
| API文档 | 每次API变更 | 开发人员 | 架构师 |
| 数据库设计 | 每次表结构变更 | DBA | 架构师 |
| 测试用例 | 每次功能发布 | 测试工程师 | 产品经理 |

## 项目状态

| 项目阶段 | 状态 | 进度 |
|---------|------|------|
| 需求分析 | ✅ 已完成 | 100% |
| 系统设计 | ✅ 已完成 | 100% |
| 核心开发 | 🔄 进行中 | 60% |
| 测试验证 | ⏳ 待开始 | 0% |
| 上线部署 | ⏳ 待开始 | 0% |

## 联系方式

- 项目负责人：[待填写]
- 技术支持：[待填写]
- 问题反馈：[待填写]

---

*最后更新：2026-03-10*
