# AI 财务助手 - 项目管理系统

## 系统概述

本项目管理系统是一个标准化的软件开发管理平台，集成文档管理、任务跟踪、需求变更管理、进度监控等功能。

## 功能模块

### 1. 文档管理

**文档分类**
- 需求文档
- 技术文档
- 数据库文档
- 项目进度文档
- 测试文档
- 需求变更记录

**文档状态流程**
```
draft → review → approved/rejected
```

**访问路径**
- 项目文档中心：`/project` → 文档管理标签
- 文档存储：`docs/` 目录

### 2. 任务管理

**任务类型**
- feature - 功能开发
- bug - Bug修复
- refactor - 代码重构
- test - 测试任务
- docs - 文档编写

**任务状态机**
```
todo → in_progress → in_review → done
         ↘ blocked
```

**Kanban看板**
- 待开始
- 进行中
- 审核中
- 已完成
- 阻塞

### 3. 需求变更管理

**变更类型**
- functional - 功能变更
- non-functional - 非功能变更
- emergency - 紧急变更
- documentation - 文档变更

**变更流程**
```
pending → in_review → approved/rejected → implemented
```

**影响评估维度**
- 技术影响
- 业务影响
- 进度影响

### 4. 里程碑管理

**里程碑状态**
- planned - 计划中
- in_progress - 进行中
- completed - 已完成
- delayed - 已延期
- cancelled - 已取消

**里程碑元素**
- 里程碑名称和描述
- 目标日期和实际日期
- 进度百分比
- 验收标准
- 关联任务

## 技术实现

### Store结构
```
useProjectStore (Zustand)
├── documents: ProjectDocument[]
├── tasks: Task[]
├── changes: ChangeRequest[]
├── milestones: Milestone[]
└── actions: 各类CRUD操作
```

### 数据持久化
- 使用Zustand的persist中间件
- 存储名称：`ai-finance-project-storage`
- 自动保存到localStorage

### 文件结构
```
src/
├── stores/
│   └── useProjectStore.ts    # 项目管理状态
├── components/
│   └── project/              # 项目管理组件
│       ├── kanban-board.tsx
│       ├── task-card.tsx
│       ├── task-dialog.tsx
│       ├── document-list.tsx
│       ├── document-dialog.tsx
│       ├── change-request-list.tsx
│       ├── change-request-dialog.tsx
│       ├── milestone-list.tsx
│       └── milestone-dialog.tsx
└── app/
    └── project/
        └── page.tsx          # 项目管理仪表板

docs/                         # 文档中心
├── requirements/              # 需求文档
├── technical/                # 技术文档
├── database/                 # 数据库文档
├── progress/                 # 进度文档
├── tests/                   # 测试文档
└── changes/                  # 变更记录
```

## 使用指南

### 快速开始

1. **访问项目管理中心**
   - 点击侧边栏"项目管理"菜单
   - 进入项目管理仪表板

2. **创建任务**
   - 点击"新建任务"按钮
   - 填写任务信息
   - 选择优先级和负责人

3. **管理文档**
   - 切换到"文档管理"标签
   - 选择文档分类
   - 创建或编辑文档

4. **处理需求变更**
   - 切换到"需求变更"标签
   - 查看变更请求
   - 审批或拒绝变更

5. **跟踪里程碑**
   - 切换到"里程碑"标签
   - 查看里程碑进度
   - 更新里程碑状态

### 最佳实践

#### 任务管理
- 使用Kanban看板可视化任务进度
- 及时更新任务状态
- 记录任务工时（预估和实际）
- 关联相关文档和依赖任务

#### 文档管理
- 使用统一的文档命名规范
- 及时更新文档状态
- 添加标签方便检索
- 记录文档版本历史

#### 变更管理
- 详细描述变更原因和影响
- 完整评估技术、业务、进度影响
- 及时处理待审核变更
- 记录变更决策和意见

## 系统特性

### AI智能匹配
- 基于关键词的L1规则匹配
- 基于用户偏好的L2学习匹配
- 双向匹配算法
- 置信度评分

### 自动化模板引擎
- 预设业务模板
- 公式计算支持
- 自动触发机制
- 模板验证规则

### 数据持久化
- 本地存储同步
- 跨会话数据保留
- 自动备份机制

## 配置说明

### 环境变量
```bash
# 无需额外配置
# 所有数据存储在浏览器本地
```

### 数据初始化
系统启动时自动初始化示例数据：
- 示例文档
- 示例任务
- 示例需求变更
- 示例里程碑

## 扩展开发

### 添加新组件
1. 在 `src/components/project/` 创建组件
2. 在 `src/app/project/page.tsx` 导入使用

### 添加新文档类型
1. 在 `docs/` 创建新分类目录
2. 在 `useProjectStore.ts` 更新类型定义
3. 在文档列表组件添加标签页

### 添加新状态/类型
1. 更新 TypeScript 类型定义
2. 更新组件的状态映射
3. 更新样式的颜色配置

## 故障排除

### 数据未保存
- 检查浏览器localStorage是否启用
- 查看控制台是否有错误
- 尝试清除缓存后重试

### 任务无法拖拽
- 确认使用支持的浏览器
- 检查组件是否正确渲染
- 查看控制台拖拽事件

## 未来计划

- 数据迁移到云端数据库
- 多用户协作支持
- 移动端适配
- 高级报表功能
- 权限管理系统
- 通知提醒功能

---

*创建日期：2026-03-10*
*维护者：项目组*