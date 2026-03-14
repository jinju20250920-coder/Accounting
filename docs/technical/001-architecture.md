# AI 财务助手 - 技术架构设计

## 1. 架构概述

### 1.1 设计理念
AI财务助手采用现代化的前后端分离架构，前端使用Next.js框架，后端使用Next.js API Routes。系统设计遵循以下原则：
- **模块化**：功能模块独立，易于维护和扩展
- **类型安全**：全面使用TypeScript，确保代码质量
- **状态分离**：UI状态与业务数据分离
- **可扩展**：预留接口支持未来功能扩展

### 1.2 整体架构

```
┌─────────────────────────────────────┐
│             前端层                  │
│  ┌─────────────┐ ┌─────────────┐   │
│  │   Page      │ │   Component │   │
│  │   (Next.js) │ │   (React)   │   │
│  └─────────────┘ └─────────────┘   │
├─────────────────────────────────────┤
│             业务层                  │
│  ┌─────────────┐ ┌─────────────┐   │
│  │ Accounting │ │ Template   │   │
│  │    Engine   │ │    Engine  │   │
│  └─────────────┘ └─────────────┘   │
├─────────────────────────────────────┤
│             数据层                  │
│  ┌─────────────┐ ┌─────────────┐   │
│  │    Store    │ │   Local    │   │
│  │   (Zustand) │ │  Storage   │   │
│  └─────────────┘ └─────────────┘   │
└─────────────────────────────────────┘
```

## 2. 技术栈详解

### 2.1 前端技术栈

#### 核心框架
- **Next.js 16**：React全栈框架，支持服务端渲染
- **React 19**：最新的React版本，支持新的并发特性
- **TypeScript**：类型安全的JavaScript超集

#### UI组件
- **shadcn/ui**：现代化的React组件库
- **Tailwind CSS**：实用优先的CSS框架
- **Lucide React**：美观的图标库
- **@tanstack/react-table**：强大的表格组件

#### 状态管理
- **Zustand**：轻量级状态管理库
- **React Context**：共享状态传递
- **Local Storage**：本地数据持久化

#### 工具库
- **clsx**：条件类名合并
- **tailwind-merge**：Tailwind类名合并
- **date-fns**：日期处理库

### 2.2 后端技术栈

#### API层
- **Next.js API Routes**：服务端API处理
- **RESTful设计**：规范的API接口
- **OpenAPI规范**：API文档标准

#### 数据层（未来规划）
- **PostgreSQL**：主数据库
- **Prisma**：现代ORM
- **Redis**：缓存层
- **Supabase**：实时数据库

#### 认证授权
- **NextAuth.js**：身份验证
- **JWT**：令牌认证
- **RBAC**：基于角色的访问控制

### 2.3 开发工具

#### 代码规范
- **ESLint**：代码质量检查
- **Prettier**：代码格式化
- **TypeScript Strict Mode**：严格类型检查

#### 测试框架
- **Vitest**：单元测试
- **Playwright**：端到端测试
- **Testing Library**：测试工具库

#### 构建部署
- **Next.js内置构建**：优化的生产构建
- **Docker**：容器化部署
- **Vercel**：云平台部署

## 3. 目录结构

### 3.1 项目结构

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # 根布局
│   ├── page.tsx           # 首页
│   ├── project/           # 项目管理页面
│   ├── balance/           # 余额查询页面
│   ├── reports/           # 报表页面
│   ├── sets/              # 账套管理
│   ├── exchange/          # 汇率管理
│   ├── import/            # 导入功能
│   └── closing/           # 期末结转
├── components/            # React组件
│   ├── ui/                # shadcn/ui组件
│   ├── layout/            # 布局组件
│   ├── voucher/           # 凭证组件
│   └── project/           # 项目管理组件
├── stores/                # Zustand状态管理
│   ├── useVoucherStore.ts  # 凭证状态
│   ├── useProjectStore.ts # 项目管理状态
│   ├── useUserPreferenceStore.ts # 用户偏好
│   └── useAuditStore.ts   # 审计日志
├── lib/                   # 业务逻辑
│   ├── accounting.ts      # 会计引擎
│   ├── ai-learning.ts     # AI学习模块
│   ├── template-engine.ts # 模板引擎
│   ├── parser.ts          # 解析器
│   └── data/              # 数据配置
│       ├── keyword-rules.json
│       ├── subjects.json
│       └── templates.json
└── types/                 # TypeScript类型
    └── index.ts
```

### 3.2 组件分层

#### UI层（Components）
- **基础组件**：Button, Input, Card等
- **布局组件**：Sidebar, Header, Footer
- **业务组件**：VoucherGrid, SubjectSearch
- **页面组件**：各个页面的实现

#### 业务层（Lib）
- **会计引擎**：凭证处理、余额计算
- **AI模块**：智能匹配、用户偏好
- **模板引擎**：凭证模板、公式解析
- **工具函数**：通用工具方法

#### 数据层（Stores）
- **凭证状态**：当前凭证数据
- **项目状态**：项目管理数据
- **用户偏好**：用户历史行为
- **审计日志**：操作记录

## 4. 核心模块设计

### 4.1 会计引擎（Accounting Engine）

```typescript
// 会计核心函数
interface AccountingEngine {
  // 凭证处理
  createVoucher(data: VoucherData): Voucher;
  postVoucher(id: string): void;
  reverseVoucher(id: string): Voucher;

  // 余额计算
  calculateSubjectBalance(subjectCode: string): Balance;

  // 验证
  validateVoucher(voucher: Voucher): ValidationResult;
}
```

### 4.2 AI学习模块（AI Learning）

```typescript
interface AIEngine {
  // 匹配算法
  matchSubject(summary: string): MatchResult;

  // 用户偏好
  recordPreference(userId: string, preference: UserPreference);
  getRecommendations(summary: string): Subject[];
}
```

### 4.3 模板引擎（Template Engine）

```typescript
interface TemplateEngine {
  // 模板管理
  getTemplate(id: string): VoucherTemplate;
  createTemplate(data: TemplateData): VoucherTemplate;

  // 凭证生成
  generateVoucher(template: VoucherTemplate, data: any): Voucher;
}
```

## 5. 数据流设计

### 5.1 用户交互流程

```
用户操作 → UI组件 → Action调用 → Store更新 → 组件重渲染 → UI更新
```

### 5.2 数据持久化流程

```
数据变更 → Store更新 → LocalStorage同步 → 下次加载恢复
```

### 5.3 API调用流程

```
前端请求 → 中间件处理 → 业务逻辑 → 数据库操作 → 返回响应
```

## 6. 性能优化

### 6.1 前端优化
- **代码分割**：按需加载组件
- **图片优化**：Next.js Image组件
- **虚拟列表**：大数据量列表优化
- **缓存策略**：SWR缓存数据

### 6.2 后端优化（未来）
- **数据库索引**：优化查询性能
- **Redis缓存**：热点数据缓存
- **CDN加速**：静态资源加速
- **负载均衡**：分布式部署

## 7. 安全设计

### 7.1 前端安全
- **XSS防护**：输入验证和转义
- **CSRF防护**：Token验证
- **数据加密**：敏感数据加密存储

### 7.2 后端安全（未来）
- **SQL注入防护**：参数化查询
- **身份验证**：JWT令牌
- **权限控制**：RBAC模型
- **审计日志**：操作记录

## 8. 监控和日志

### 8.1 错误监控
- **Sentry集成**：错误追踪
- **错误边界**：React错误捕获
- **全局错误处理**：统一错误处理

### 8.2 性能监控
- **Lighthouse**：性能评分
- **Web Vitals**：核心指标
- **自定义指标**：业务指标

### 8.3 日志记录
- **操作日志**：用户行为记录
- **错误日志**：系统错误记录
- **性能日志**：性能数据记录

## 9. 扩展性设计

### 9.1 插件系统
- **钩子机制**：生命周期钩子
- **插件注册**：动态加载插件
- **API扩展**：插件自定义API

### 9.2 主题系统
- **CSS变量**：主题变量定义
- **动态切换**：运行时主题切换
- **定制主题**：用户自定义主题

### 9.3 国际化
- **i18n支持**：多语言支持
- **动态加载**：按需加载语言包
- **RTL支持**：从右到左语言

## 10. 部署方案

### 10.1 开发环境
- **本地开发**：Next.js开发服务器
- **热重载**：代码修改自动刷新
- **Mock数据**：开发环境模拟数据

### 10.2 生产环境
- **静态导出**：静态站点生成
- **服务器部署**：Node.js服务器
- **容器化部署**：Docker容器

### 10.3 CI/CD流程
- **代码检查**：ESLint + Prettier
- **自动化测试**：单元测试 + 集成测试
- **自动部署**：GitHub Actions自动化

---

## 附录

### A. 技术选型对比
| 技术 | 选择理由 | 替代方案 |
|------|----------|----------|
| Next.js | 全栈框架，SSR支持 | Nuxt.js, Remix |
| Zustand | 轻量级状态管理 | Redux, MobX |
| shadcn/ui | 现代化组件库 | Ant Design, Material-UI |
| Tailwind CSS | 原子化CSS | Styled-components, CSS Modules |

### B. 参考资料
- [Next.js官方文档](https://nextjs.org/docs)
- [React官方文档](https://react.dev)
- [TypeScript官方文档](https://www.typescriptlang.org/docs)
- [Zustand官方文档](https://docs.pmnd.rs/zustand)

---

*版本：v1.0*
*创建日期：2026-03-10*
*作者：架构师*
*审核人：[待填写]*