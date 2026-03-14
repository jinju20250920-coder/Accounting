# Claude Team 项目结构设计

## 📋 项目概述

**项目名称**：AI财务助手
**技术栈**：Next.js 16 + React 19 + TypeScript + Zustand + shadcn/ui
**目标**：构建现代化的财务凭证管理系统

---

## 🤖 Agent分工方案

### Agent 1: 前端开发专家 (Frontend Developer)

#### 职责范围
```
┌─────────────────────────────────────────────────────────┐
│  前端开发专家 (Frontend Developer)                 │
├─────────────────────────────────────────────────────────┤
│ • React组件开发                                  │
│ • Next.js页面路由配置                             │
│ • shadcn/ui组件集成与定制                        │
│ • Tailwind CSS样式优化                             │
│ • 响应式设计实现                                │
│ • 前端状态管理 (Zustand)                       │
│ • 用户交互逻辑实现                                │
└─────────────────────────────────────────────────────────┘
```

#### 负责模块
| 模块 | 具体任务 |
|------|----------|
| 凭证录入 | VoucherEntryGrid组件、科目选择器 |
| 报表展示 | 资产负债表、损益表、现金流量表 |
| 账套管理 | 账套列表、期初余额录入 |
| 汇兑损益 | 汇率管理、自动调汇界面 |
| 基础档案 | 科目管理、部门管理、项目管理 |

#### 技术要求
```typescript
// 核心技能
- React 19 新特性熟练运用
- TypeScript 类型安全开发
- Tailwind CSS 实用类编写
- shadcn/ui 组件定制
- Zustand 状态管理
- Next.js App Router
- 表单验证与处理
```

---

### Agent 2: 后端开发专家 (Backend Developer)

#### 职责范围
```
┌─────────────────────────────────────────────────────────┐
│  后端开发专家 (Backend Developer)                   │
├─────────────────────────────────────────────────────────┤
│ • API路由设计与实现 (Next.js API Routes)           │
│ • 数据模型设计 (PostgreSQL)                       │
│ • Prisma ORM 集成                                │
│ • 会计引擎核心逻辑                              │
│ • 数据持久化方案                                │
│ • 性能优化与索引设计                             │
│ • 安全性实现 (认证、授权)                        │
└─────────────────────────────────────────────────────────┘
```

#### 负责模块
| 模块 | API接口 | 数据表 |
|------|----------|---------|
| 凭证管理 | /api/vouchers | vouchers, voucher_entries |
| 科目管理 | /api/subjects | subjects |
| 账套管理 | /api/accounts | accounts |
| 用户管理 | /api/users | users |
| 审计日志 | /api/audit-logs | audit_logs |

#### 技术要求
```typescript
// 核心技能
- RESTful API 设计
- SQL 数据库优化
- 数据建模与索引设计
- 身份认证 (JWT/Session)
- 权限控制 (RBAC)
- 数据库事务处理
- 缓存策略 (Redis)
```

---

### Agent 3: AI算法专家 (AI/ML Specialist)

#### 职责范围
```
┌─────────────────────────────────────────────────────────┐
│  AI算法专家 (AI/ML Specialist)                    │
├─────────────────────────────────────────────────────────┤
│ • AI智能匹配算法设计                             │
│ • 用户偏好学习模型                              │
│ • 关键词规则引擎优化                            │
│ • 公式解释器实现                                │
│ • 模板自动化引擎                                │
│ • 机器学习模型调优                              │
│ • 推荐算法优化                                  │
└─────────────────────────────────────────────────────────┘
```

#### 负责模块
| 功能 | 技术实现 |
|------|----------|
| 智能科目匹配 | L1关键词规则 + L2用户偏好 |
| 用户学习 | 向量相似度、时序权重 |
| 模板引擎 | 公式解析、变量替换 |
| 数据导入 | 银行流水智能分类 |

#### 技术要求
```typescript
// 核心技能
- 自然语言处理 (NLP)
- 机器学习算法 (相似度计算)
- 向量数据库 (可选)
- 推荐系统设计
- 规则引擎优化
- 性能调优
```

---

### Agent 4: 测试工程师 (QA Engineer)

#### 职责范围
```
┌─────────────────────────────────────────────────────────┐
│  测试工程师 (QA Engineer)                         │
├─────────────────────────────────────────────────────────┤
│ • 单元测试编写 (Vitest)                          │
│ • 集成测试设计                                   │
│ • 端到端测试 (Playwright)                       │
│ • 测试用例设计与执行                              │
│ • 测试覆盖率分析                                 │
│ • Bug追踪与验证                                   │
│ • 性能测试                                       │
└─────────────────────────────────────────────────────────┘
```

#### 负责模块
| 测试类型 | 覆盖范围 |
|----------|----------|
| 单元测试 | 核心业务逻辑函数 |
| 集成测试 | API接口测试 |
| E2E测试 | 关键用户流程 |
| 性能测试 | 数据加载、响应时间 |

#### 技术要求
```typescript
// 核心技能
- Vitest 单元测试框架
- Playwright E2E 测试
- 测试覆盖率分析
- Mock 数据生成
- 测试报告生成
- Bug 生命周期管理
```

---

### Agent 5: 项目经理 (Project Manager)

#### 职责范围
```
┌─────────────────────────────────────────────────────────┐
│  项目经理 (Project Manager)                       │
├─────────────────────────────────────────────────────────┤
│ • 项目计划与里程碑管理                            │
│ • 任务分配与跟踪                                │
│ • 需求变更评审                                  │
│ • 进度汇报与协调                                │
│ • 风险识别与管控                                │
│ • 文档审核                                      │
│ • 发布计划制定                                   │
└─────────────────────────────────────────────────────────┘
```

#### 负责内容
| 管理项 | 具体任务 |
|---------|----------|
| 任务管理 | 创建任务、分配负责人、跟踪进度 |
| 文档管理 | 审核文档、管理版本、维护知识库 |
| 需求变更 | 评审变更、影响评估、决策审批 |
| 里程碑跟踪 | 设置里程碑、更新进度、发布协调 |
| 风险管理 | 识别风险、制定应对措施 |
| 沟通协调 | 组织会议、同步信息、解决冲突 |

#### 技术要求
```typescript
// 核心技能
- 项目管理方法论 (Agile/Scrum)
- 需求分析能力
- 风险评估
- 沟通协调
- 文档管理
- 优先级判断
```

---

### Agent 6: DevOps工程师 (DevOps Engineer)

#### 职责范围
```
┌─────────────────────────────────────────────────────────┐
│  DevOps工程师 (DevOps Engineer)                    │
├─────────────────────────────────────────────────────────┤
│ • CI/CD流水线配置                                │
│ • Docker容器化                                   │
│ • 云部署管理 (Vercel/AWS)                        │
│ • 数据库迁移与备份                               │
│ • 监控与告警                                    │
│ • 环境管理 (开发/测试/生产)                     │
│ • 性能监控                                       │
└─────────────────────────────────────────────────────────┘
```

#### 负责内容
| 基础设施 | 具体任务 |
|----------|----------|
| CI/CD | GitHub Actions配置、自动化测试集成 |
| 部署 | Vercel部署配置、环境变量管理 |
| 数据库 | 备份策略、迁移脚本、监控 |
| 监控 | 错误追踪(Sentry)、性能监控 |

#### 技术要求
```typescript
// 核心技能
- Docker 容器化
- CI/CD 工具 (GitHub Actions)
- 云平台部署 (Vercel/Supabase)
- 数据库运维
- 监控工具配置
- 自动化脚本编写
```

---

## 🔄 协作流程设计

### 开发周期流程

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Sprint 开发周期 (2周)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                  │
│  周一: Sprint Planning                                           │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐   │
│  │ 需求分析 │ 架构设计 │ 任务分配 │ 风险评估 │ 里程碑设定 │   │
│  │项目经理   │ 架构师   │项目经理   │项目经理   │项目经理   │   │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘   │
│                                                                  │
│  周二-周四: 开发 + 测试                                        │
│  ┌──────────────────────────────────────────────────────────┐         │
│  │ 前端开发 │ 后端开发 │ AI算法 │ 测试编写 │ 并行工作 │         │
│  │───────────│───────────│─────────│───────────│          │         │
│  │   Agent 1 │   Agent 2 │ Agent 3 │   Agent 4 │          │         │
│  └──────────────────────────────────────────────────────────┘         │
│                                                                  │
│  周五: 代码审查 + 集成测试 + 部署                            │
│  ┌──────────────────────────────────────────────────────────┐         │
│  │ Code Review │ 集成测试 │ 部署准备 │            │         │
│  │  所有Agent  │ QA Agent  │ DevOps    │            │         │
│  └──────────────────────────────────────────────────────────┘         │
│                                                                  │
│  周五下午: Sprint Review & Retrospective                      │
│  ┌────────────┬────────────┐                                  │
│  │ 演示功能   │ 总结经验   │                                  │
│  │ 所有Agent   │ 所有Agent   │                                  │
│  └────────────┴────────────┘                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 代码提交流程

```
开发 Agent                    代码审查 Agent                DevOps Agent
    │                              │                        │
    │ 1. 本地开发                   │                        │
    ├────────────────────────────┐      │                        │
    │                         │      │                        │
    │ 2. 编写测试                │      │                        │
    ├────────────────────────────┼─────┤                        │
    │                         │      │                        │
    │ 3. 提交代码                │      │                        │
    ├────────────────────────────┼─────┼────────────────────────┐   │
    │                         │      │                        │   │
    │                         ▼      ▼                        │   │
    │                    feature分支               │   │
    │                              │                │   │
    │                         4. 自动CI运行        │   │
    │                         │ (测试+构建)        │   │
    │                         ▼                │   │
    │                    测试结果            │   │
    │                              │                │   │
    │ 5. Code Review Request       │                │   │
    ├─────────────────────────────────────┼────────────────┼───┤
    │                              │                │   │
    │ 6. 审查反馈                │                │   │
    ├─────────────────────────────────────┼────────────────┼───┤
    │                              │                │   │
    │ 7. 修复问题                │                │   │
    ├─────────────────────────────────────┼────────────────┼───┤
    │                              │                │   │
    │                         8. 合并到主分支      │   │
    │                              │                │   │
    │ 9. 自动部署                │                │   │
    │                              │                │   │
    └───────────────────────────────┴────────────────┴───┘
```

### 需求处理流程

```
用户/业务方                 产品经理 (Agent 5)            开发团队
    │                            │                        │
    │ 1. 提交新需求               │                        │
    ├───────────────────────────┐      │                        │
    │                            │      │                        │
    │                            ▼      │                        │
    │                      2. 需求分析               │                        │
    │                            │  (可行性/成本/价值)    │                        │
    │                            ├────────────────────────┐   │
    │                            │                    │   │
    │                            ▼                    │   │
    │                      3. 需求评审               │                        │
    │                      (与团队确认)             │                        │
    │                            │                    │                        │
    │                            ├──────┬───────┬───┤   │
    │                            │      │       │   │   │
    │                            ▼      ▼       ▼   │   │
    │                      前端   后端   测试   │   │
    │                      Agent   Agent   Agent   │   │
    │                            │      │       │   │
    │ 4. 开发实现                │      │       │   │
    ├──────────────────────────────────────────────────┤   │
    │                            │      │       │   │   │
    │ 5. 测试验证                │      │       │   │   │
    ├──────────────────────────────────────────────────┤   │
    │                            │      │       │   │   │
    │ 6. 用户验收                │      │       │   │   │
    └──────────────────────────────────────────────────┘
```

### Bug修复流程

```
QA Agent (发现Bug)              开发 Agent                验证 Agent
    │                               │                        │
    │ 1. 报告Bug                   │                        │
    ├───────────────────────────┐      │                        │
    │                           │      │                        │
    │ 2. 分配给负责人               │      │                        │
    ├──────────────────────────────────┼────────────────────┐   │
    │                           │                        │   │   │
    │                           ▼                        │   │   │
    │                     3. 定位和修复问题                │   │   │
    │                           │                        │   │   │
    │                           ├────────────────────────┼───┤   │
    │                           │                        │   │   │
    │ 4. 修复验证                │                        │   │   │
    ├──────────────────────────────────────────────────┤   │
    │                           │                        │   │   │
    │ 5. 回归测试                │                        │   │   │
    ├──────────────────────────────────────────────────┤   │
    │                           │                        │   │   │
    │ 6. Bug关闭                │                        │   │   │
    └──────────────────────────────────────────────────┘
```

---

## 📚 共享知识库结构

### 知识库目录结构

```
knowledge-base/
├── 01-project-overview/          # 项目概览
│   ├── README.md              # 项目介绍
│   ├── tech-stack.md          # 技术栈说明
│   └── team-structure.md      # 团队结构
│
├── 02-requirements/              # 需求文档
│   ├── 001-system-overview.md  # 系统概览
│   ├── 002-user-stories.md    # 用户故事
│   ├── 003-functional-reqs.md # 功能需求
│   └── 004-non-functional-reqs.md # 非功能需求
│
├── 03-architecture/             # 架构设计
│   ├── 001-system-arch.md     # 系统架构
│   ├── 002-data-model.md      # 数据模型
│   ├── 003-api-design.md      # API设计
│   └── 004-security-design.md  # 安全设计
│
├── 04-frontend/                # 前端文档
│   ├── 001-component-lib.md   # 组件库
│   ├── 002-state-mgmt.md     # 状态管理
│   ├── 003-styling-guide.md  # 样式指南
│   └── 004-page-routes.md    # 页面路由
│
├── 05-backend/                 # 后端文档
│   ├── 001-api-routes.md     # API路由
│   ├── 002-database-schema.md # 数据库表结构
│   ├── 003-auth-flow.md     # 认证流程
│   └── 004-cache-strategy.md # 缓存策略
│
├── 06-ai-engine/               # AI引擎
│   ├── 001-matching-algo.md  # 匹配算法
│   ├── 002-learning-model.md  # 学习模型
│   ├── 003-template-engine.md # 模板引擎
│   └── 004-formula-parser.md # 公式解析器
│
├── 07-testing/                # 测试文档
│   ├── 001-test-strategy.md  # 测试策略
│   ├── 002-unit-tests.md     # 单元测试
│   ├── 003-integration-tests.md # 集成测试
│   └── 004-e2e-tests.md     # 端到端测试
│
├── 08-operations/              # 运维文档
│   ├── 001-deployment.md     # 部署流程
│   ├── 002-cicd-pipeline.md # CI/CD配置
│   ├── 003-monitoring.md    # 监控方案
│   └── 004-backup.md       # 备份策略
│
├── 09-standards/               # 标准规范
│   ├── 001-coding-standards.md # 编码规范
│   ├── 002-git-workflow.md   # Git工作流
│   ├── 003-review-guide.md   # 代码审查指南
│   └── 004-api-docs.md     # API文档规范
│
└── 10-decisions/              # 决策记录
    ├── 001-tech-decisions.md  # 技术决策
    ├── 002-arch-decisions.md  # 架构决策
    └── 003-change-logs.md   # 变更日志
```

### 知识库内容示例

#### 项目概览 (01-project-overview/README.md)
```markdown
# AI财务助手 - 项目概览

## 项目目标
构建现代化的Web会计凭证录入系统，集成AI智能匹配功能。

## 核心特性
1. Excel-like凭证录入界面
2. AI智能科目推荐
3. 自动化模板引擎
4. 完整的会计引擎
5. 项目管理系统

## 技术栈
- 前端: Next.js 16 + React 19 + TypeScript
- UI: shadcn/ui + Tailwind CSS
- 状态: Zustand
- 后端: Next.js API Routes
- 数据库: PostgreSQL + Prisma
```

#### 架构设计 (03-architecture/001-system-arch.md)
```markdown
# 系统架构设计

## 整体架构
```
┌─────────────────────────────────────────────────┐
│              前端层                      │
│  Next.js 16 + React 19 + shadcn/ui      │
└───────────────┬─────────────────────────┘
                │ REST API
┌───────────────▼─────────────────────────┐
│              后端层                      │
│  Next.js API Routes + Prisma          │
└───────────────┬─────────────────────────┘
                │
┌───────────────▼─────────────────────────┐
│              数据层                      │
│  PostgreSQL + Redis                  │
└───────────────────────────────────────┘
```

## 模块划分
- 凭证管理: VoucherModule
- 科目管理: SubjectModule
- 报表查询: ReportModule
- 项目管理: ProjectModule
- AI引擎: AIEngine
```

#### API设计 (03-architecture/003-api-design.md)
```markdown
# API设计规范

## RESTful约定
```
GET    /api/vouchers          # 获取凭证列表
POST   /api/vouchers          # 创建新凭证
GET    /api/vouchers/:id       # 获取单个凭证
PUT    /api/vouchers/:id       # 更新凭证
DELETE /api/vouchers/:id       # 删除凭证
POST   /api/vouchers/:id/post  # 记账
POST   /api/vouchers/:id/reverse # 冲销
```

## 响应格式
```json
{
  "success": true,
  "data": {...},
  "message": "操作成功"
}
```

## 错误处理
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "借方和贷方不平衡"
  }
}
```
```

#### 编码规范 (09-standards/001-coding-standards.md)
```markdown
# 编码规范

## 命名约定
- 组件: PascalCase (e.g., VoucherEntryGrid)
- 函数: camelCase (e.g., calculateBalance)
- 常量: UPPER_SNAKE_CASE (e.g., MAX_VOUCHER_ENTRIES)
- 类型: IPascalCase (e.g., IVoucher)

## 文件组织
```
src/
├── components/
│   ├── ui/              # shadcn/ui组件
│   ├── project/         # 项目管理组件
│   └── voucher/         # 凭证组件
├── lib/
│   ├── accounting.ts     # 会计引擎
│   ├── ai-learning.ts    # AI模块
│   └── template-engine.ts # 模板引擎
└── stores/
    └── use*.ts          # Zustand stores
```

## 代码审查检查项
- [ ] TypeScript类型正确
- [ ] 没有console.log
- [ ] 错误已处理
- [ ] 添加必要的注释
- [ ] 遵循命名约定
```

---

## 🔧 Git仓库配置

### 仓库结构

```
ai-finance-assistant/
├── .github/                   # GitHub配置
│   └── workflows/           # CI/CD工作流
│       ├── test.yml          # 自动测试
│       ├── lint.yml          # 代码检查
│       └── deploy.yml       # 自动部署
├── src/                       # 源代码
├── public/                    # 静态资源
├── docs/                      # 文档中心
├── tests/                     # 测试文件
├── prisma/                    # 数据库schema
├── scripts/                   # 脚本工具
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

### Git工作流配置 (.github/workflows/ci.yml)

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run lint
        run: npm run lint

      - name: Run tests
        run: npm run test

      - name: Build
        run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
```

### 分支策略

```
main (主分支，生产环境)
  │
  ├── develop (开发分支，集成测试环境)
  │   │
  │   ├── feature/voucher-entry (功能分支)
  │   ├── feature/ai-matching (功能分支)
  │   ├── feature/project-management (功能分支)
  │   │
  │   └── bugfix/login-issue (修复分支)
  │
  └── hotfix/critical-bug (紧急修复分支)
```

### 提交规范 (Commit Convention)

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Type 类型
- `feat`: 新功能
- `fix`: Bug修复
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建/工具链更新

#### 示例
```
feat(voucher): 添加凭证自动保存功能

- 实现定时自动保存机制
- 添加保存状态指示器

Closes #123
```

---

## 📋 协作工具配置

### 1. Claude Team项目设置

```json
{
  "project": {
    "name": "AI财务助手",
    "description": "现代化会计凭证管理系统",
    "type": "full-stack-web-app",
    "language": "TypeScript"
  },
  "agents": [
    {
      "id": "frontend-dev",
      "name": "前端开发专家",
      "role": "负责React组件和UI开发"
    },
    {
      "id": "backend-dev",
      "name": "后端开发专家",
      "role": "负责API和数据库设计"
    },
    {
      "id": "ai-ml-specialist",
      "name": "AI算法专家",
      "role": "负责AI匹配和学习算法"
    },
    {
      "id": "qa-engineer",
      "name": "测试工程师",
      "role": "负责测试和质量保证"
    },
    {
      "id": "project-manager",
      "name": "项目经理",
      "role": "负责项目协调和进度管理"
    },
    {
      "id": "devops-engineer",
      "name": "DevOps工程师",
      "role": "负责CI/CD和部署"
    }
  ],
  "knowledge_base": {
    "repository": "知识库存储位置",
    "structure": "按模块和类型组织"
  },
  "git": {
    "repository": "ai-finance-assistant",
    "platform": "GitHub",
    "ci_cd": "GitHub Actions + Vercel"
  }
}
```

### 2. 共享上下文配置

每个Agent需要访问的上下文：

```typescript
// 全局上下文
const globalContext = {
  project: {
    name: "AI财务助手",
    techStack: "Next.js 16 + React 19 + TypeScript",
    goals: ["凭证录入", "AI匹配", "报表查询", "项目管理"]
  },
  architecture: {
    frontend: "React + shadcn/ui",
    backend: "Next.js API Routes",
    database: "PostgreSQL",
    state: "Zustand"
  },
  codingStandards: {
    language: "TypeScript",
    style: "ESLint + Prettier",
    framework: "shadcn/ui components"
  },
  api: {
    base: "/api",
    format: "RESTful",
    authentication: "JWT"
  }
};
```

---

## 🎯 下一步行动计划

### 阶段1: 准备阶段 (第1周)
- [ ] 创建Claude Team项目
- [ ] 配置Git仓库
- [ ] 初始化知识库
- [ ] 分配Agent角色
- [ ] 设置CI/CD流水线

### 阶段2: 功能开发 (第2-4周)
- [ ] 实现凭证管理模块
- [ ] 实现科目管理模块
- [ ] 实现AI匹配功能
- [ ] 实现项目管理模块
- [ ] 完成单元测试

### 阶段3: 集成测试 (第5-6周)
- [ ] 完成集成测试
- [ ] 端到端测试覆盖
- [ ] 性能测试
- [ ] 代码审查

### 阶段4: 部署上线 (第7周)
- [ ] 生产环境部署
- [ ] 监控配置
- [ ] 文档完善
- [ ] 用户培训

---

## 📞 支持联系

- **项目管理**: Agent 5 (项目经理)
- **技术问题**: Agent 2 (后端开发专家)
- **代码审查**: 所有开发Agent
- **测试问题**: Agent 4 (测试工程师)
- **部署问题**: Agent 6 (DevOps工程师)

---

*文档版本*: v1.0
*创建日期*: 2026-03-10
*最后更新*: 2026-03-10
